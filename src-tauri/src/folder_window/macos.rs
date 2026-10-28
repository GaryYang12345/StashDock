//! AppKit owns gestures and tracking. Core Animation owns visual feedback.
#[path = "macos_animation.rs"]
mod animation;
use objc2::{
    define_class, msg_send, rc::Retained, runtime::AnyObject, sel, AnyThread, DefinedClass,
    MainThreadMarker, MainThreadOnly,
};
use objc2_app_kit::{
    NSAccessibility, NSButton, NSCellImagePosition, NSEvent, NSTrackingArea, NSTrackingAreaOptions,
    NSView, NSWindow,
};
use objc2_core_graphics::CGEvent;
use objc2_foundation::{NSObjectProtocol, NSPoint, NSRect, NSSize, NSString};
use std::cell::{Cell, RefCell};
use tauri::{AppHandle, Manager, Window};

#[derive(Clone, Copy)]
struct Gesture {
    origin: NSPoint,
    grab: NSPoint,
    moved: bool,
}
impl Gesture {
    fn position(&mut self, screen: NSPoint) -> Option<NSPoint> {
        let next = NSPoint::new(
            self.origin.x + screen.x - self.grab.x,
            self.origin.y + self.grab.y - screen.y,
        );
        self.moved |= (next.x - self.origin.x).hypot(next.y - self.origin.y) >= 5.0;
        self.moved.then_some(next)
    }
}
struct Folder {
    window: Window,
    gesture: RefCell<Option<Gesture>>,
    hovered: Cell<bool>,
    search_open: Cell<bool>,
    artwork: animation::Artwork,
}
define_class!(
    #[unsafe(super = NSButton)]
    #[thread_kind = MainThreadOnly]
    #[ivars = Folder]
    struct NativeFolder;
    unsafe impl NSObjectProtocol for NativeFolder {}
    impl NativeFolder {
        #[unsafe(method(acceptsFirstMouse:))]
        fn accepts_first_mouse(&self, _event: Option<&NSEvent>) -> bool { true }
        #[unsafe(method(mouseEntered:))]
        fn mouse_entered(&self, _event: &NSEvent) {
            self.ivars().hovered.set(true);
            self.ivars().artwork.update(true, self.ivars().gesture.borrow().is_some(), false);
            if self.ivars().gesture.borrow().is_none() { crate::folder_search_macos::hover(true); }
        }
        #[unsafe(method(mouseExited:))]
        fn mouse_exited(&self, _event: &NSEvent) {
            self.ivars().hovered.set(false);
            self.ivars().artwork.update(self.ivars().search_open.get(), self.ivars().gesture.borrow().is_some(), false);
            if self.ivars().gesture.borrow().is_none() { crate::folder_search_macos::hover(false); }
        }
        #[unsafe(method(mouseDown:))]
        fn mouse_down(&self, event: &NSEvent) {
            *self.ivars().gesture.borrow_mut() = self.window().zip(event.CGEvent())
                .map(|(window, input)| Gesture {
                    origin: window.frame().origin,
                    grab: CGEvent::location(Some(&input)), moved: false,
                });
            crate::folder_search_macos::folder_gesture(true);
            self.ivars().artwork.update(self.ivars().hovered.get(), true, false);
        }
        #[unsafe(method(mouseDragged:))]
        fn mouse_dragged(&self, event: &NSEvent) {
            if let Some((window, input)) = self.window().zip(event.CGEvent()) {
                let next = self.ivars().gesture.borrow_mut().as_mut()
                    .and_then(|gesture| gesture.position(CGEvent::location(Some(&input))));
                if let Some(point) = next { window.setFrameOrigin(point); }
            }
        }
        #[unsafe(method(mouseUp:))]
        fn mouse_up(&self, event: &NSEvent) {
            let gesture = self.ivars().gesture.borrow_mut().take();
            let point = self.convertPoint_fromView(event.locationInWindow(), None);
            let bounds = self.bounds();
            let inside = point.x >= bounds.origin.x && point.y >= bounds.origin.y
                && point.x < bounds.origin.x + bounds.size.width && point.y < bounds.origin.y + bounds.size.height;
            self.ivars().hovered.set(inside);
            self.ivars().artwork.update(inside, false, false);
            if let Some(gesture) = gesture {
                if gesture.moved {
                    let app = self.ivars().window.app_handle();
                    crate::desktop_windows::remember(app, &self.ivars().window);
                    crate::desktop_windows::persist_later(app);
                    let _ = crate::folder_search_macos::attach(app);
                    crate::folder_search_macos::folder_gesture(false);
                    crate::folder_search_macos::hover(inside);
                } else {
                    crate::folder_search_macos::folder_gesture(false);
                    crate::desktop_windows::show_panel(self.ivars().window.app_handle());
                }
            } else {
                crate::folder_search_macos::folder_gesture(false);
                crate::folder_search_macos::hover(inside);
            }
        }
        #[unsafe(method(openFolder:))]
        fn open_folder(&self, _sender: Option<&AnyObject>) {
            crate::desktop_windows::show_panel(self.ivars().window.app_handle());
        }
        #[unsafe(method(hideFolder:))]
        fn hide_folder(&self, _sender: Option<&AnyObject>) {
            crate::desktop_windows::hide(self.ivars().window.app_handle());
        }
    }
);

pub fn install(app: &AppHandle) -> Result<(), String> {
    let mtm = MainThreadMarker::new().ok_or("Folder creation requires the UI thread.")?;
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "folder")
        .ok_or("The folder configuration is missing.")?
        .clone();
    let window = tauri::window::WindowBuilder::from_config(app, &config)
        .map_err(|error| error.to_string())?
        .build()
        .map_err(|error| error.to_string())?;
    let pointer = window.ns_window().map_err(|error| error.to_string())?;
    // SAFETY: Tauri owns this live NSWindow on the main thread. Preserve its
    // delegate, frame and lifecycle; install native content with no WebView.
    let native =
        unsafe { pointer.cast::<NSWindow>().as_ref() }.ok_or("The folder is unavailable.")?;
    let allocated = NativeFolder::alloc(mtm).set_ivars(Folder {
        window: window.clone(),
        gesture: RefCell::new(None),
        hovered: Cell::new(false),
        search_open: Cell::new(false),
        artwork: animation::Artwork::new()?,
    });
    let bounds = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(144.0, 144.0));
    let view: Retained<NativeFolder> =
        unsafe { msg_send![super(allocated), initWithFrame: bounds] };
    view.setWantsLayer(true);
    view.ivars().artwork.set_coordinates(view.isFlipped());
    view.layer()
        .ok_or("The folder layer is unavailable.")?
        .addSublayer(&view.ivars().artwork.root);
    let tracking = unsafe {
        NSTrackingArea::initWithRect_options_owner_userInfo(
            NSTrackingArea::alloc(),
            bounds,
            NSTrackingAreaOptions::MouseEnteredAndExited
                | NSTrackingAreaOptions::ActiveAlways
                | NSTrackingAreaOptions::InVisibleRect
                | NSTrackingAreaOptions::EnabledDuringMouseDrag,
            Some(&view),
            None,
        )
    };
    view.addTrackingArea(&tracking);
    view.setTitle(&NSString::new());
    view.setKeyEquivalent(&NSString::from_str("\r"));
    view.setBordered(false);
    view.setImagePosition(NSCellImagePosition::ImageOnly);
    unsafe {
        view.setTarget(Some(&view));
        view.setAction(Some(sel!(openFolder:)));
    }
    // The visible close mark is part of the shared front layer, so it follows
    // every folder transform. A transparent native sibling owns only input and
    // accessibility: no template tint, system appearance color or second image.
    let close = unsafe {
        NSButton::buttonWithTitle_target_action(
            &NSString::new(),
            Some(&view),
            Some(sel!(hideFolder:)),
            mtm,
        )
    };
    close.setFrame(NSRect::new(
        NSPoint::new(96.3, 47.7),
        NSSize::new(28.8, 28.8),
    ));
    close.setBordered(false);
    close.setTransparent(true);
    // Sibling native buttons expose separate accessibility/keyboard actions.
    // Nesting Close inside NSButton would hide it from the accessibility tree.
    let content = NSView::initWithFrame(NSView::alloc(mtm), bounds);
    content.addSubview(&view);
    content.addSubview(&close);
    native.setContentView(Some(&content));
    FOLDER.with(|slot| *slot.borrow_mut() = Some(view));
    update_labels(app, false, None);
    Ok(())
}

thread_local! { static FOLDER: RefCell<Option<Retained<NativeFolder>>> = const { RefCell::new(None) }; }
pub fn cancel_gesture() {
    FOLDER.with(|slot| {
        if let Some(view) = slot.borrow().as_ref() {
            view.ivars().gesture.borrow_mut().take();
            view.ivars().hovered.set(false);
            view.ivars().search_open.set(false);
            view.ivars().artwork.update(false, false, true);
        }
    });
}
pub fn search_visible(_app: &AppHandle, visible: bool, release_delay: f64) {
    FOLDER.with(|slot| {
        if let Some(view) = slot.borrow().as_ref() {
            view.ivars().search_open.set(visible);
            view.ivars().artwork.update_after(
                visible || view.ivars().hovered.get(),
                view.ivars().gesture.borrow().is_some(),
                false,
                release_delay,
            );
        }
    });
}

pub fn update_labels(app: &AppHandle, chinese: bool, theme: Option<tauri::Theme>) {
    let app = app.clone();
    let owner = app.clone();
    let _ = owner.run_on_main_thread(move || {
        if let Some(window) = app.get_window("folder") {
            let _ = window.set_theme(theme);
            if let Ok(pointer) = window.ns_window() {
                // SAFETY: The folder is live on its owning UI thread.
                if let Some(native) = unsafe { pointer.cast::<NSWindow>().as_ref() } {
                    if let Some(content) = native.contentView() {
                        let children = content.subviews();
                        if let Some(view) = children.firstObject() {
                            view.setAccessibilityLabel(Some(&NSString::from_str(if chinese {
                                "打开 StashDock"
                            } else {
                                "Open StashDock"
                            })));
                            view.setAccessibilityHelp(Some(&NSString::from_str(if chinese {
                                "单击打开，拖动移动。"
                            } else {
                                "Click to open. Drag to move."
                            })));
                        }
                        if let Some(close) = children.lastObject() {
                            close.setAccessibilityLabel(Some(&NSString::from_str(if chinese {
                                "隐藏 StashDock"
                            } else {
                                "Hide StashDock"
                            })));
                        }
                    }
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_gesture_distinguishes_click_drag_and_return_to_origin() {
        let mut gesture = Gesture {
            origin: NSPoint::new(-100.0, 50.0),
            grab: NSPoint::new(20.0, 30.0),
            moved: false,
        };
        assert!(gesture.position(NSPoint::new(22.0, 32.0)).is_none());
        assert_eq!(
            gesture.position(NSPoint::new(50.0, 10.0)),
            Some(NSPoint::new(-70.0, 70.0))
        );
        assert_eq!(
            gesture.position(NSPoint::new(20.0, 30.0)),
            Some(gesture.origin)
        );
        assert!(
            gesture.moved,
            "A drag returning to its starting point must never open the library"
        );
    }
}
