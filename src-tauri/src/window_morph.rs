//! Spatial handoff between the folder and the panel, composed by DWM.
//!
//! Neither real window is resized, painted into a bitmap or captured. A
//! transparent, input-transparent overlay hosts live DWM thumbnails of both
//! windows (the same composition Windows uses for taskbar previews) while the
//! real windows are cloaked; the panel's thumbnail grows out of the folder (or
//! shrinks back into it) on the shared enter/in-out curves. The lifecycle
//! authority runs it synchronously between preparing and revealing the real
//! windows, so ordering, rollback and focus are unchanged. Any failure, or the
//! system's "Animation effects" being off, falls back to the direct handoff.
use std::time::Duration;
#[cfg(windows)]
use std::time::Instant;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}
impl Rect {
    fn width(self) -> f64 {
        (self.right - self.left) as f64
    }
    fn height(self) -> f64 {
        (self.bottom - self.top) as f64
    }
    fn centre(self) -> (f64, f64) {
        (
            (self.left + self.right) as f64 / 2.0,
            (self.top + self.bottom) as f64 / 2.0,
        )
    }
    fn around(centre: (f64, f64), width: f64, height: f64) -> Rect {
        Rect {
            left: (centre.0 - width / 2.0).round() as i32,
            top: (centre.1 - height / 2.0).round() as i32,
            right: (centre.0 + width / 2.0).round() as i32,
            bottom: (centre.1 + height / 2.0).round() as i32,
        }
    }
    fn lerp(a: Rect, b: Rect, t: f64) -> Rect {
        let mix = |x: i32, y: i32| (x as f64 + (y - x) as f64 * t).round() as i32;
        Rect {
            left: mix(a.left, b.left),
            top: mix(a.top, b.top),
            right: mix(a.right, b.right),
            bottom: mix(a.bottom, b.bottom),
        }
    }
    fn union(a: Rect, b: Rect) -> Rect {
        Rect {
            left: a.left.min(b.left),
            top: a.top.min(b.top),
            right: a.right.max(b.right),
            bottom: a.bottom.max(b.bottom),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Direction {
    /// Folder to panel.
    Expand,
    /// Panel back into the folder.
    Collapse,
}
impl Direction {
    fn duration(self) -> Duration {
        match self {
            Direction::Expand => Duration::from_millis(340),
            Direction::Collapse => Duration::from_millis(270),
        }
    }
}

/// Cubic Bézier easing (x1, y1, x2, y2), as in the shared motion tokens.
fn bezier(x1: f64, y1: f64, x2: f64, y2: f64, t: f64) -> f64 {
    let t = t.clamp(0.0, 1.0);
    let curve = |a: f64, b: f64, s: f64| {
        let u = 1.0 - s;
        3.0 * u * u * s * a + 3.0 * u * s * s * b + s * s * s
    };
    // Solve x(s) = t by bisection: monotonic, exact enough for 1px motion.
    let (mut low, mut high) = (0.0, 1.0);
    for _ in 0..32 {
        let mid = (low + high) / 2.0;
        if curve(x1, x2, mid) < t {
            low = mid;
        } else {
            high = mid;
        }
    }
    curve(y1, y2, (low + high) / 2.0)
}
/// motionTokens.ease.enter: soft, non-overshooting landing.
fn enter(t: f64) -> f64 {
    bezier(0.16, 1.0, 0.3, 1.0, t)
}
/// motionTokens.ease.inOut: for travel between two resting places.
fn in_out(t: f64) -> f64 {
    bezier(0.65, 0.0, 0.35, 1.0, t)
}
fn ramp(t: f64, from: f64, to: f64) -> f64 {
    ((t - from) / (to - from)).clamp(0.0, 1.0)
}

/// Where both windows are drawn at progress `t` (0..=1), with their opacity.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub panel: Rect,
    pub panel_opacity: u8,
    pub folder: Rect,
    pub folder_opacity: u8,
}

/// The panel starts (or ends) as a small card over the folder, keeping its
/// own proportions so its content is never stretched.
fn seed(panel: Rect, folder: Rect) -> Rect {
    let width = folder.width() * 1.5;
    let height = width * panel.height() / panel.width().max(1.0);
    Rect::around(folder.centre(), width, height)
}

/// Where the shadow carrier sits while the panel is drawn at `dest`. The
/// panel's window rect includes invisible resize borders (`insets`) that the
/// thumbnail scales with it; the carrier keeps them at their real size so its
/// visible edge (and so its DWM shadow) hugs the scaled visible content.
pub fn shadow_rect(dest: Rect, window: Rect, insets: Rect) -> Rect {
    let sx = dest.width() / window.width().max(1.0);
    let sy = dest.height() / window.height().max(1.0);
    let inset = |edge: i32, value: i32, scale: f64, sign: f64| {
        (edge as f64 + sign * value as f64 * scale - sign * value as f64).round() as i32
    };
    Rect {
        left: inset(dest.left, insets.left, sx, 1.0),
        top: inset(dest.top, insets.top, sy, 1.0),
        right: inset(dest.right, insets.right, sx, -1.0),
        bottom: inset(dest.bottom, insets.bottom, sy, -1.0),
    }
}

pub fn frame(direction: Direction, panel: Rect, folder: Rect, t: f64) -> Frame {
    let small = seed(panel, folder);
    let opacity = |v: f64| (v.clamp(0.0, 1.0) * 255.0).round() as u8;
    let scaled = |scale: f64| Rect::around(folder.centre(), folder.width() * scale, folder.height() * scale);
    match direction {
        Direction::Expand => {
            let e = enter(t);
            Frame {
                panel: Rect::lerp(small, panel, e),
                panel_opacity: opacity(enter(ramp(t, 0.0, 0.32))),
                folder: scaled(1.0 + 0.14 * e),
                folder_opacity: opacity(1.0 - ramp(t, 0.0, 0.28)),
            }
        }
        Direction::Collapse => {
            let e = in_out(t);
            Frame {
                panel: Rect::lerp(panel, small, e),
                panel_opacity: opacity(1.0 - ramp(t, 0.5, 1.0)),
                folder: scaled(0.86 + 0.14 * enter(ramp(t, 0.35, 1.0))),
                folder_opacity: opacity(enter(ramp(t, 0.55, 1.0))),
            }
        }
    }
}

/// Windows' own "Animation effects" setting (Settings > Accessibility).
pub fn enabled() -> bool {
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SystemParametersInfoW, SPI_GETCLIENTAREAANIMATION,
        };
        let mut on: i32 = 1;
        if SystemParametersInfoW(SPI_GETCLIENTAREAANIMATION, 0, (&mut on as *mut i32).cast(), 0) == 0 {
            return true;
        }
        on != 0
    }
    #[cfg(not(windows))]
    false
}

/// Wait for two composed frames, so a window shown while cloaked has drawn.
pub fn settle() {
    #[cfg(windows)]
    unsafe {
        for _ in 0..2 {
            if windows_sys::Win32::Graphics::Dwm::DwmFlush() < 0 {
                std::thread::sleep(Duration::from_millis(16));
            }
        }
    }
}

#[cfg(windows)]
pub use native::Morph;

#[cfg(windows)]
mod native {
    use super::*;
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM},
        Foundation::POINT,
        Graphics::Dwm::{
            DwmFlush, DwmRegisterThumbnail, DwmSetWindowAttribute, DwmUnregisterThumbnail,
            DwmUpdateThumbnailProperties, DWMWA_TRANSITIONS_FORCEDISABLED,
            DWM_THUMBNAIL_PROPERTIES, DWM_TNP_OPACITY, DWM_TNP_RECTDESTINATION,
            DWM_TNP_SOURCECLIENTAREAONLY, DWM_TNP_VISIBLE,
        },
        Graphics::Gdi::ClientToScreen,
        System::LibraryLoader::GetModuleHandleW,
        UI::WindowsAndMessaging::{
            CreateWindowExW, DefWindowProcW, DestroyWindow, GetClientRect, GetForegroundWindow,
            GetWindowLongPtrW, GetWindowRect, IsZoomed, RegisterClassExW, SendMessageW,
            SetWindowLongPtrW, SetWindowPos, ShowWindow, CREATESTRUCTW, GWLP_USERDATA, GWL_STYLE,
            HTTRANSPARENT, MA_NOACTIVATE, NCCALCSIZE_PARAMS, SWP_NOACTIVATE, SWP_SHOWWINDOW,
            SW_HIDE, SW_SHOWNOACTIVATE, WM_MOUSEACTIVATE, WM_NCACTIVATE, WM_NCCALCSIZE,
            WM_NCCREATE, WM_NCHITTEST, WNDCLASSEXW, WS_CAPTION, WS_DISABLED, WS_EX_NOACTIVATE,
            WS_EX_NOREDIRECTIONBITMAP, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT,
            WS_MAXIMIZE, WS_MINIMIZE, WS_POPUP, WS_THICKFRAME, WS_VISIBLE,
        },
    };
    use std::cell::Cell;

    unsafe extern "system" fn procedure(hwnd: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        // Never takes input: the pointer reaches whatever is underneath.
        if message == WM_NCHITTEST {
            return HTTRANSPARENT as LRESULT;
        }
        DefWindowProcW(hwnd, message, wparam, lparam)
    }

    /// What the shadow carrier's procedure needs: the panel's real
    /// non-client insets, and whether to draw as the active window.
    struct Carrier {
        insets: Rect,
        active: bool,
    }

    unsafe extern "system" fn shadow_procedure(hwnd: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if message == WM_NCCREATE {
            let create = &*(lparam as *const CREATESTRUCTW);
            SetWindowLongPtrW(hwnd, GWLP_USERDATA, create.lpCreateParams as isize);
            return DefWindowProcW(hwnd, message, wparam, lparam);
        }
        let carrier = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *const Carrier;
        match message {
            WM_NCHITTEST => return HTTRANSPARENT as LRESULT,
            WM_MOUSEACTIVATE => return MA_NOACTIVATE as LRESULT,
            // The panel's own borderless frame (tao's undecorated shadow):
            // keep its insets as non-client so DWM draws the same edge and
            // shadow around an empty client.
            WM_NCCALCSIZE if !carrier.is_null() => {
                let insets = (*carrier).insets;
                let rect = if wparam != 0 {
                    &mut (*(lparam as *mut NCCALCSIZE_PARAMS)).rgrc[0]
                } else {
                    &mut *(lparam as *mut RECT)
                };
                rect.left += insets.left;
                rect.top += insets.top;
                rect.right -= insets.right;
                rect.bottom -= insets.bottom;
                return 0;
            }
            // Drawn as active when the panel is (or is about to be), so its
            // shadow is the one the real panel shows.
            WM_NCACTIVATE if !carrier.is_null() && (*carrier).active => {
                return DefWindowProcW(hwnd, message, 1, lparam);
            }
            _ => {}
        }
        DefWindowProcW(hwnd, message, wparam, lparam)
    }

    /// An empty window with the panel's own frame, moved under the panel's
    /// thumbnail so the travelling panel keeps its real DWM shadow (thumbnails
    /// never include shadows). It shows and hides with DWM's own fade.
    struct Shadow {
        hwnd: HWND,
        carrier: *mut Carrier,
        insets: Rect,
        shown: Cell<bool>,
    }

    impl Shadow {
        fn new(panel_hwnd: HWND, owner: HWND, active: bool) -> Option<Shadow> {
            unsafe {
                // A maximized panel has no shadow.
                if IsZoomed(panel_hwnd) != 0 {
                    return None;
                }
                let style = GetWindowLongPtrW(panel_hwnd, GWL_STYLE) as u32;
                if style & WS_CAPTION != WS_CAPTION || style & WS_THICKFRAME == 0 {
                    return None;
                }
                let mut window = RECT { left: 0, top: 0, right: 0, bottom: 0 };
                let mut client = RECT { left: 0, top: 0, right: 0, bottom: 0 };
                let mut origin = POINT { x: 0, y: 0 };
                if GetWindowRect(panel_hwnd, &mut window) == 0
                    || GetClientRect(panel_hwnd, &mut client) == 0
                    || ClientToScreen(panel_hwnd, &mut origin) == 0
                {
                    return None;
                }
                let insets = Rect {
                    left: origin.x - window.left,
                    top: origin.y - window.top,
                    right: window.right - (origin.x + client.right),
                    bottom: window.bottom - (origin.y + client.bottom),
                };
                if [insets.left, insets.top, insets.right, insets.bottom].iter().any(|v| !(0..=64).contains(v)) {
                    return None;
                }
                let class = shadow_class().ok()?;
                let carrier = Box::into_raw(Box::new(Carrier { insets, active }));
                // Owned by the (topmost) folder: no taskbar button, no Alt+Tab.
                let hwnd = CreateWindowExW(
                    WS_EX_TOPMOST | WS_EX_NOACTIVATE | WS_EX_NOREDIRECTIONBITMAP,
                    class.as_ptr(),
                    std::ptr::null(),
                    style & !(WS_VISIBLE | WS_MAXIMIZE | WS_MINIMIZE | WS_DISABLED),
                    window.left,
                    window.top,
                    (window.right - window.left).max(1),
                    (window.bottom - window.top).max(1),
                    owner,
                    std::ptr::null_mut(),
                    GetModuleHandleW(std::ptr::null()),
                    carrier as *const core::ffi::c_void,
                );
                if hwnd.is_null() {
                    drop(Box::from_raw(carrier));
                    return None;
                }
                if active {
                    SendMessageW(hwnd, WM_NCACTIVATE, 1, 0);
                }
                Some(Shadow { hwnd, carrier, insets, shown: Cell::new(false) })
            }
        }

        /// Whether DWM fades this window in and out as it shows and hides.
        fn fades(&self, on: bool) {
            let disabled: i32 = i32::from(!on);
            unsafe {
                DwmSetWindowAttribute(
                    self.hwnd,
                    DWMWA_TRANSITIONS_FORCEDISABLED as u32,
                    (&disabled as *const i32).cast(),
                    std::mem::size_of::<i32>() as u32,
                );
            }
        }

        /// Directly beneath the overlay, so it never covers either thumbnail.
        fn place(&self, overlay: HWND, rect: Rect, show: bool) {
            let flags = SWP_NOACTIVATE | if show { SWP_SHOWWINDOW } else { 0 };
            unsafe {
                SetWindowPos(self.hwnd, overlay, rect.left, rect.top, (rect.right - rect.left).max(1), (rect.bottom - rect.top).max(1), flags);
            }
            if show {
                self.shown.set(true);
            }
        }

        fn hide(&self) {
            if self.shown.replace(false) {
                unsafe {
                    ShowWindow(self.hwnd, SW_HIDE);
                }
            }
        }
    }

    impl Drop for Shadow {
        fn drop(&mut self) {
            // Removed at once: the real panel (or nothing) is already in place.
            self.fades(false);
            unsafe {
                DestroyWindow(self.hwnd);
                drop(Box::from_raw(self.carrier));
            }
        }
    }

    fn class() -> Result<Vec<u16>, String> {
        use std::sync::OnceLock;
        static REGISTERED: OnceLock<bool> = OnceLock::new();
        register(&REGISTERED, "StashDockHandoff", procedure)
    }

    fn shadow_class() -> Result<Vec<u16>, String> {
        use std::sync::OnceLock;
        static REGISTERED: OnceLock<bool> = OnceLock::new();
        register(&REGISTERED, "StashDockHandoffShadow", shadow_procedure)
    }

    fn register(
        registered: &std::sync::OnceLock<bool>,
        name: &str,
        procedure: unsafe extern "system" fn(HWND, u32, WPARAM, LPARAM) -> LRESULT,
    ) -> Result<Vec<u16>, String> {
        let name: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
        let ok = *registered.get_or_init(|| unsafe {
            let class = WNDCLASSEXW {
                cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
                style: 0,
                lpfnWndProc: Some(procedure),
                cbClsExtra: 0,
                cbWndExtra: 0,
                hInstance: GetModuleHandleW(std::ptr::null()),
                hIcon: std::ptr::null_mut(),
                hCursor: std::ptr::null_mut(),
                hbrBackground: std::ptr::null_mut(),
                lpszMenuName: std::ptr::null(),
                lpszClassName: name.as_ptr(),
                hIconSm: std::ptr::null_mut(),
            };
            RegisterClassExW(&class) != 0
        });
        if ok {
            Ok(name)
        } else {
            Err("Could not prepare the window transition.".into())
        }
    }

    /// The live overlay. Must be created, finished and dropped on the UI thread.
    pub struct Morph {
        hwnd: HWND,
        origin: (i32, i32),
        panel_thumb: isize,
        folder_thumb: isize,
        direction: Direction,
        panel: Rect,
        folder: Rect,
        shadow: Option<Shadow>,
    }

    impl Morph {
        pub fn begin(panel_hwnd: isize, folder_hwnd: isize, panel: Rect, folder: Rect, direction: Direction) -> Result<Morph, String> {
            let class = class()?;
            // Cover both resting places plus the folder's grown/shrunk size.
            let margin = (folder.width() * 0.3).round() as i32;
            let area = Rect::union(
                panel,
                Rect { left: folder.left - margin, top: folder.top - margin, right: folder.right + margin, bottom: folder.bottom + margin },
            );
            unsafe {
                let hwnd = CreateWindowExW(
                    WS_EX_TOOLWINDOW | WS_EX_TOPMOST | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT | WS_EX_NOREDIRECTIONBITMAP,
                    class.as_ptr(),
                    std::ptr::null(),
                    WS_POPUP,
                    area.left,
                    area.top,
                    (area.right - area.left).max(1),
                    (area.bottom - area.top).max(1),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    GetModuleHandleW(std::ptr::null()),
                    std::ptr::null(),
                );
                if hwnd.is_null() {
                    return Err("Could not prepare the window transition.".into());
                }
                let mut morph = Morph { hwnd, origin: (area.left, area.top), panel_thumb: 0, folder_thumb: 0, direction, panel, folder, shadow: None };
                if DwmRegisterThumbnail(hwnd, panel_hwnd as HWND, &mut morph.panel_thumb) < 0
                    || DwmRegisterThumbnail(hwnd, folder_hwnd as HWND, &mut morph.folder_thumb) < 0
                {
                    return Err("Could not prepare the window transition.".into());
                }
                morph.show(0.0)?;
                // The panel draws as active once it lands (it takes focus);
                // a collapse starts from whatever state it is in.
                let active = match direction {
                    Direction::Expand => true,
                    Direction::Collapse => GetForegroundWindow() == panel_hwnd as HWND,
                };
                morph.shadow = Shadow::new(panel_hwnd as HWND, folder_hwnd as HWND, active);
                if direction == Direction::Collapse {
                    // Already in place, under the panel's own shadow, before
                    // the panel is cloaked: no change at the first frame.
                    if let Some(shadow) = morph.shadow.as_ref() {
                        shadow.fades(false);
                        shadow.place(hwnd, panel, true);
                    }
                }
                ShowWindow(hwnd, SW_SHOWNOACTIVATE);
                DwmFlush();
                Ok(morph)
            }
        }

        fn place(&self, thumb: isize, rect: Rect, opacity: u8) -> Result<(), String> {
            let props = DWM_THUMBNAIL_PROPERTIES {
                dwFlags: DWM_TNP_RECTDESTINATION | DWM_TNP_OPACITY | DWM_TNP_VISIBLE | DWM_TNP_SOURCECLIENTAREAONLY,
                rcDestination: RECT {
                    left: rect.left - self.origin.0,
                    top: rect.top - self.origin.1,
                    right: rect.right - self.origin.0,
                    bottom: rect.bottom - self.origin.1,
                },
                rcSource: RECT { left: 0, top: 0, right: 0, bottom: 0 },
                opacity,
                fVisible: i32::from(opacity > 0),
                fSourceClientAreaOnly: 0,
            };
            if unsafe { DwmUpdateThumbnailProperties(thumb, &props) } < 0 {
                return Err("Could not draw the window transition.".into());
            }
            Ok(())
        }

        fn show(&self, t: f64) -> Result<(), String> {
            let frame = frame(self.direction, self.panel, self.folder, t);
            // The folder is drawn over the panel, as its real window is topmost.
            self.place(self.panel_thumb, frame.panel, frame.panel_opacity)?;
            self.place(self.folder_thumb, frame.folder, frame.folder_opacity)?;
            if let Some(shadow) = self.shadow.as_ref() {
                let rect = shadow_rect(frame.panel, self.panel, shadow.insets);
                match self.direction {
                    // Fades in with the panel (DWM's own show transition)...
                    Direction::Expand => shadow.place(self.hwnd, rect, t > 0.0),
                    // ...and fades out as the panel starts to fade.
                    Direction::Collapse if frame.panel_opacity < 255 => shadow.hide(),
                    Direction::Collapse => shadow.place(self.hwnd, rect, false),
                }
            }
            Ok(())
        }

        /// Plays the whole transition, one step per composed frame. Blocks the
        /// UI thread for its fraction of a second, as the direct handoff does
        /// for its native calls; WebView rendering continues in its own process.
        pub fn play(&self) -> Result<(), String> {
            let duration = self.direction.duration();
            if let Some(shadow) = self.shadow.as_ref() {
                shadow.fades(true);
            }
            let start = Instant::now();
            for _ in 0..240 {
                let t = start.elapsed().as_secs_f64() / duration.as_secs_f64();
                self.show(t.min(1.0))?;
                if t >= 1.0 {
                    break;
                }
                if unsafe { DwmFlush() } < 0 {
                    std::thread::sleep(Duration::from_millis(8));
                }
            }
            Ok(())
        }

        /// Wait until the real windows' revealed state has been composed, so
        /// removing the overlay never leaves an empty frame. Called after the
        /// destination took focus, so the panel's own (active) shadow is
        /// already the one the carrier shows.
        pub fn finish(self) {
            unsafe {
                DwmFlush();
            }
            drop(self);
        }
    }

    impl Drop for Morph {
        fn drop(&mut self) {
            self.shadow.take();
            unsafe {
                if self.panel_thumb != 0 {
                    DwmUnregisterThumbnail(self.panel_thumb);
                }
                if self.folder_thumb != 0 {
                    DwmUnregisterThumbnail(self.folder_thumb);
                }
                DestroyWindow(self.hwnd);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const PANEL: Rect = Rect { left: 400, top: 120, right: 1580, bottom: 880 };
    const FOLDER: Rect = Rect { left: 1700, top: 800, right: 1844, bottom: 944 };

    #[test]
    fn curves_start_and_end_at_rest_without_overshoot() {
        for curve in [enter as fn(f64) -> f64, in_out] {
            assert!(curve(0.0).abs() < 1e-6);
            assert!((curve(1.0) - 1.0).abs() < 1e-6);
            let mut last = 0.0;
            for step in 1..=100 {
                let value = curve(step as f64 / 100.0);
                assert!(value >= last - 1e-9 && value <= 1.0 + 1e-9);
                last = value;
            }
        }
    }

    #[test]
    fn expansion_grows_out_of_the_folder_and_lands_on_the_panel() {
        let first = frame(Direction::Expand, PANEL, FOLDER, 0.0);
        let small = seed(PANEL, FOLDER);
        assert_eq!(first.panel, small);
        assert_eq!(first.panel_opacity, 0);
        assert_eq!(first.folder, FOLDER);
        assert_eq!(first.folder_opacity, 255);
        // Proportions are kept: the panel content is never stretched.
        assert!((small.width() / small.height() - PANEL.width() / PANEL.height()).abs() < 0.01);
        assert_eq!(small.centre(), FOLDER.centre());
        let last = frame(Direction::Expand, PANEL, FOLDER, 1.0);
        assert_eq!(last.panel, PANEL);
        assert_eq!(last.panel_opacity, 255);
        assert_eq!(last.folder_opacity, 0);
    }

    #[test]
    fn the_shadow_hugs_the_scaled_visible_panel() {
        let insets = Rect { left: 8, top: 1, right: 8, bottom: 8 };
        // At rest it is exactly the panel's window.
        assert_eq!(shadow_rect(PANEL, PANEL, insets), PANEL);
        // Half size: visible content is the scaled one; borders keep their size.
        let half = Rect::around(PANEL.centre(), PANEL.width() / 2.0, PANEL.height() / 2.0);
        let rect = shadow_rect(half, PANEL, insets);
        assert_eq!(rect.left, half.left + 4 - 8);
        assert_eq!(rect.right, half.right - 4 + 8);
        assert_eq!(rect.bottom, half.bottom - 4 + 8);
    }

    #[test]
    fn collapse_is_the_reverse_path_into_the_folder() {
        let first = frame(Direction::Collapse, PANEL, FOLDER, 0.0);
        assert_eq!(first.panel, PANEL);
        assert_eq!(first.panel_opacity, 255);
        assert_eq!(first.folder_opacity, 0);
        let last = frame(Direction::Collapse, PANEL, FOLDER, 1.0);
        assert_eq!(last.panel, seed(PANEL, FOLDER));
        assert_eq!(last.panel_opacity, 0);
        assert_eq!(last.folder, FOLDER);
        assert_eq!(last.folder_opacity, 255);
    }
}
