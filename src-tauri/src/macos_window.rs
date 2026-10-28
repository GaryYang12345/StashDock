//! AppKit controls and the Mac menu adapt to the shared window coordinator.
//! Never replace Tao's NSWindow delegate or draw imitation traffic lights.
use objc2::{
    define_class, msg_send, rc::Retained, runtime::AnyObject, sel, DefinedClass, MainThreadMarker,
    MainThreadOnly,
};
use objc2_app_kit::{NSWindow, NSWindowButton};
use objc2_foundation::{NSObject, NSObjectProtocol};
use std::cell::RefCell;
use tauri::{
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem as Native, Submenu},
    AppHandle, Emitter, Manager,
};

struct Actions {
    app: AppHandle,
}
extern "C" {
    fn stashdock_window_chrome_install(window: *mut std::ffi::c_void);
}
define_class!(
    #[unsafe(super = NSObject)]
    #[thread_kind = MainThreadOnly]
    #[ivars = Actions]
    struct StashDockWindowActions;
    unsafe impl NSObjectProtocol for StashDockWindowActions {}
    impl StashDockWindowActions {
        #[unsafe(method(minimize:))]
        fn minimize(&self, _sender: Option<&AnyObject>) {
            crate::desktop_windows::minimize(&self.ivars().app);
        }
    }
);
thread_local! {
    // NSControl does not retain its target. The one main window owns this
    // bounded receiver for the application's lifetime.
    static ACTIONS: RefCell<Option<Retained<StashDockWindowActions>>> = const { RefCell::new(None) };
}
pub fn install(app: &AppHandle) -> Result<(), String> {
    let mtm = MainThreadMarker::new().ok_or("Window controls require the UI thread.")?;
    let panel = app
        .get_webview_window("main")
        .ok_or("The library window is unavailable.")?;
    let pointer = panel.ns_window().map_err(|error| error.to_string())?;
    // SAFETY: Tauri owns a live NSWindow on this main thread. We change only
    // title presentation and standard minimize button target; Tao keeps its
    // delegate and frame. Keep the title for accessibility and native menus.
    let window = unsafe { pointer.cast::<NSWindow>().as_ref() }
        .ok_or("The native window is unavailable.")?;
    unsafe { stashdock_window_chrome_install(pointer) };
    let button = window
        .standardWindowButton(NSWindowButton::MiniaturizeButton)
        .ok_or("The native minimize button is unavailable.")?;
    let allocated = StashDockWindowActions::alloc(mtm).set_ivars(Actions { app: app.clone() });
    let receiver: Retained<StashDockWindowActions> = unsafe { msg_send![super(allocated), init] };
    unsafe {
        button.setTarget(Some(&receiver));
        button.setAction(Some(sel!(minimize:)));
    }
    ACTIONS.with(|state| *state.borrow_mut() = Some(receiver));
    Ok(())
}
pub fn update_menu(app: &AppHandle, chinese: bool) -> tauri::Result<()> {
    let text = |en, zh| if chinese { zh } else { en };
    let separator = || Native::separator(app);
    let about = Native::about(
        app,
        Some(text("About StashDock", "关于 StashDock")),
        Some(AboutMetadata {
            name: Some("StashDock".into()),
            version: Some(env!("CARGO_PKG_VERSION").into()),
            ..Default::default()
        }),
    )?;
    let settings = MenuItem::with_id(
        app,
        "mac-settings",
        text("Settings…", "设置…"),
        true,
        Some("CmdOrCtrl+,"),
    )?;
    let services = Native::services(app, Some(text("Services", "服务")))?;
    let hide = Native::hide(app, Some(text("Hide StashDock", "隐藏 StashDock")))?;
    let hide_others = Native::hide_others(app, Some(text("Hide Others", "隐藏其他")))?;
    let show_all = Native::show_all(app, Some(text("Show All", "全部显示")))?;
    let quit = Native::quit(app, Some(text("Quit StashDock", "退出 StashDock")))?;
    let app_menu = Submenu::with_items(
        app,
        "StashDock",
        true,
        &[
            &about,
            &separator()?,
            &settings,
            &separator()?,
            &services,
            &separator()?,
            &hide,
            &hide_others,
            &show_all,
            &separator()?,
            &quit,
        ],
    )?;
    let close = MenuItem::with_id(
        app,
        "mac-close",
        text("Close Window", "关闭窗口"),
        true,
        Some("CmdOrCtrl+W"),
    )?;
    let file = Submenu::with_items(app, text("File", "文件"), true, &[&close])?;
    let search = MenuItem::with_id(
        app,
        "mac-search",
        text("Find References…", "查找收藏…"),
        true,
        Some("CmdOrCtrl+F"),
    )?;
    let edit = Submenu::with_items(
        app,
        text("Edit", "编辑"),
        true,
        &[
            &Native::undo(app, Some(text("Undo", "撤销")))?,
            &Native::redo(app, Some(text("Redo", "重做")))?,
            &separator()?,
            &Native::cut(app, Some(text("Cut", "剪切")))?,
            &Native::copy(app, Some(text("Copy", "复制")))?,
            &Native::paste(app, Some(text("Paste", "粘贴")))?,
            &Native::select_all(app, Some(text("Select All", "全选")))?,
            &separator()?,
            &search,
        ],
    )?;
    let floating = crate::desktop_windows::floating_enabled(app);
    let minimize = MenuItem::with_id(
        app,
        "mac-minimize",
        if floating {
            text("Minimize to Floating Folder", "收起为悬浮文件夹")
        } else {
            text("Minimize", "最小化")
        },
        true,
        Some("CmdOrCtrl+M"),
    )?;
    let open = MenuItem::with_id(
        app,
        "mac-library",
        text("Show Library", "显示收藏库"),
        true,
        None::<&str>,
    )?;
    let windows = Submenu::with_items(
        app,
        text("Window", "窗口"),
        true,
        &[
            &minimize,
            &Native::maximize(app, Some(text("Zoom", "缩放")))?,
            &Native::fullscreen(app, Some(text("Enter Full Screen", "进入全屏")))?,
            &separator()?,
            &open,
        ],
    )?;
    app.set_menu(Menu::with_items(app, &[&app_menu, &file, &edit, &windows])?)?;
    refresh(app);
    Ok(())
}
pub fn refresh(app: &AppHandle) {
    let enabled = app
        .get_webview_window("main")
        .is_some_and(|panel| !panel.is_fullscreen().unwrap_or(false));
    if let Some(item) = app.menu().and_then(|menu| menu.get("mac-minimize")) {
        if let Some(item) = item.as_menuitem() {
            let _ = item.set_enabled(enabled);
        }
    }
}
pub fn menu_event(app: &AppHandle, id: &str) {
    if app
        .try_state::<crate::settings::SettingsState>()
        .is_some_and(|state| state.0.try_lock().is_err())
    {
        return;
    }
    match id {
        "mac-search" => {
            if !crate::desktop_windows::focus_folder_search(app) {
                crate::desktop_windows::show_panel(app);
                let _ = app.emit_to("main", "desktop-focus-search", ());
            }
        }
        "mac-minimize" => crate::desktop_windows::minimize(app),
        "mac-close" => crate::desktop_windows::hide(app),
        "mac-library" => crate::desktop_windows::show_panel(app),
        "mac-settings" => {
            crate::desktop_windows::show_panel(app);
            let _ = app.emit_to("main", "desktop-open-settings", ());
        }
        _ => {}
    }
}
