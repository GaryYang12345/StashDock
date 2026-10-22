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


/// The panel's own Windows drop shadow, which DWM thumbnails never include.
/// Measured from the real (active) panel shadow at 150% scale and modelled as
/// three soft rectangles relative to the panel's visible bounds; lengths scale
/// with DPI. The transition draws it under the panel thumbnail with the
/// panel's opacity, so it is already in place when the real panel (and its
/// real shadow) is revealed, and still in place when it is cloaked.
#[cfg_attr(not(windows), allow(dead_code))]
mod shadow {
    /// Measured from the real shadow (alpha over a light background, fitted
    /// to well under 1% rms): amplitude, blur x, blur y, inset from each side,
    /// top edge, bottom edge offset (px at 150%). The top edge is measured from
    /// the panel's top, or from its bottom for the layer that only darkens the
    /// area below it, so the shadow keeps its shape at any panel size.
    const ACTIVE: [(f64, f64, f64, f64, Edge, f64); 4] = [
        (0.13, 20.08, 25.70, -12.39, Edge::Top(12.02), 48.57),
        (0.07, 19.02, 50.59, -16.58, Edge::Top(393.29), 36.66),
        (0.12, 191.24, 40.46, 258.77, Edge::Bottom(337.92), 20.65),
        (0.09, 12.49, 14.25, 4.62, Edge::Top(-6.15), 11.36),
    ];
    /// The lighter shadow Windows gives an inactive window.
    const INACTIVE: [(f64, f64, f64, f64, Edge, f64); 4] = [
        (0.07, 20.43, 24.95, -6.40, Edge::Top(51.29), 50.91),
        (0.04, 21.67, 37.22, -16.19, Edge::Top(505.57), 56.86),
        (0.05, 210.30, 32.18, 232.48, Edge::Bottom(255.69), 39.91),
        (0.12, 8.75, 9.69, -0.62, Edge::Top(-1.01), 5.75),
    ];
    #[derive(Clone, Copy)]
    enum Edge {
        Top(f64),
        Bottom(f64),
    }
    /// How far past the visible edge the shadow is drawn (px at 150%).
    pub const REACH: f64 = 140.0;

    /// Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7).
    fn phi(z: f64) -> f64 {
        let x = z.abs() / std::f64::consts::SQRT_2;
        let t = 1.0 / (1.0 + 0.3275911 * x);
        let poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
        let erf = 1.0 - poly * (-x * x).exp();
        if z >= 0.0 { 0.5 * (1.0 + erf) } else { 0.5 * (1.0 - erf) }
    }

    /// A blurred span [from, to] sampled at `at`; empty spans cast nothing.
    fn span(at: f64, from: f64, to: f64, blur: f64) -> f64 {
        if to <= from {
            return 0.0;
        }
        (phi((at - from) / blur) - phi((at - to) / blur)).max(0.0)
    }

    /// Premultiplied BGRA pixels of the shadow around a `width` x `height`
    /// visible panel, `margin` px on every side; nothing under the panel.
    pub fn render(width: i32, height: i32, scale: f64, active: bool) -> (i32, i32, i32, Vec<u8>) {
        let layers = if active { ACTIVE } else { INACTIVE };
        let margin = (REACH * scale).ceil() as i32;
        let (w, h) = (width + 2 * margin, height + 2 * margin);
        let (right, bottom) = ((width + margin) as f64, (height + margin) as f64);
        let (left, top) = (margin as f64, margin as f64);
        let mut columns = Vec::new();
        let mut rows = Vec::new();
        for (amp, bx, by, ix, edge, below) in layers {
            let (bx, by, ix, below) = (bx * scale, by * scale, ix * scale, below * scale);
            let from = match edge {
                Edge::Top(offset) => top + offset * scale,
                Edge::Bottom(offset) => bottom - offset * scale,
            };
            columns.push((0..w).map(|x| span(x as f64 + 0.5, left + ix, right - ix, bx)).collect::<Vec<_>>());
            rows.push((0..h).map(|y| amp * span(y as f64 + 0.5, from, bottom + below, by)).collect::<Vec<_>>());
        }
        let mut pixels = vec![0u8; (w * h * 4) as usize];
        for y in 0..h {
            let inside_rows = y >= margin && y < margin + height;
            for x in 0..w {
                if inside_rows && x >= margin && x < margin + width {
                    continue;
                }
                let mut clear = 1.0;
                for layer in 0..layers.len() {
                    clear *= 1.0 - columns[layer][x as usize] * rows[layer][y as usize];
                }
                let alpha = ((1.0 - clear) * 255.0).round().clamp(0.0, 255.0) as u8;
                // Black, premultiplied: only the alpha channel is non-zero.
                pixels[((y * w + x) * 4 + 3) as usize] = alpha;
            }
        }
        (w, h, margin, pixels)
    }

    #[cfg(test)]
    pub fn alpha_at(pixels: &(i32, i32, i32, Vec<u8>), x: i32, y: i32) -> f64 {
        let (w, _, margin, data) = pixels;
        data[(((y + margin) * w + x + margin) * 4 + 3) as usize] as f64 / 255.0
    }
}

/// Development-only evidence for the handoff: when
/// `output/claude-review/morph/capture` exists, each transition records the
/// composed screen (shadows included) before, during and after it, plus a
/// timing log, and writes them next to that file once it has finished.
#[cfg(all(windows, debug_assertions))]
mod probe {
    use super::Rect;
    use std::cell::RefCell;
    use std::path::PathBuf;
    use std::time::Instant;
    use windows_sys::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits,
        ReleaseDC, SelectObject, SetStretchBltMode, StretchBlt, BITMAPINFO, BITMAPINFOHEADER, BI_RGB,
        CAPTUREBLT, DIB_RGB_COLORS, HALFTONE, SRCCOPY,
    };

    pub struct Probe {
        dir: PathBuf,
        stamp: String,
        area: Rect,
        start: Instant,
        shots: RefCell<Vec<(String, i32, i32, Vec<u8>)>>,
        log: RefCell<String>,
    }

    impl Probe {
        pub fn open(area: Rect, direction: super::Direction) -> Option<Probe> {
            let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("output").join("claude-review").join("morph");
            if !dir.join("capture").exists() {
                return None;
            }
            let millis = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
            let stamp = format!("{millis}-{direction:?}").to_lowercase();
            Some(Probe { dir, stamp, area, start: Instant::now(), shots: RefCell::new(Vec::new()), log: RefCell::new(String::new()) })
        }

        pub fn note(&self, text: impl AsRef<str>) {
            let at = self.start.elapsed().as_secs_f64() * 1000.0;
            self.log.borrow_mut().push_str(&format!("{at:8.1} ms  {}\n", text.as_ref()));
        }

        /// The composed screen under `area`, at full or half resolution.
        pub fn shot(&self, label: &str, half: bool) {
            let (sw, sh) = (self.area.right - self.area.left, self.area.bottom - self.area.top);
            let (w, h) = if half { (sw / 2, sh / 2) } else { (sw, sh) };
            let mut pixels = vec![0u8; (w * h * 4) as usize];
            unsafe {
                let screen = GetDC(std::ptr::null_mut());
                let memory = CreateCompatibleDC(screen);
                let bitmap = CreateCompatibleBitmap(screen, w, h);
                let old = SelectObject(memory, bitmap);
                if half {
                    SetStretchBltMode(memory, HALFTONE);
                    StretchBlt(memory, 0, 0, w, h, screen, self.area.left, self.area.top, sw, sh, SRCCOPY | CAPTUREBLT);
                } else {
                    BitBlt(memory, 0, 0, w, h, screen, self.area.left, self.area.top, SRCCOPY | CAPTUREBLT);
                }
                SelectObject(memory, old);
                let mut info: BITMAPINFO = std::mem::zeroed();
                info.bmiHeader = BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: w,
                    biHeight: -h,
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB,
                    ..std::mem::zeroed()
                };
                GetDIBits(memory, bitmap, 0, h as u32, pixels.as_mut_ptr().cast(), &mut info, DIB_RGB_COLORS);
                DeleteObject(bitmap);
                DeleteDC(memory);
                ReleaseDC(std::ptr::null_mut(), screen);
            }
            self.note(format!("shot {label}"));
            self.shots.borrow_mut().push((label.to_string(), w, h, pixels));
        }

        pub fn save(self) {
            for (label, w, h, pixels) in self.shots.into_inner() {
                let mut file = Vec::with_capacity(54 + pixels.len());
                file.extend_from_slice(b"BM");
                file.extend_from_slice(&(54 + pixels.len() as u32).to_le_bytes());
                file.extend_from_slice(&0u32.to_le_bytes());
                file.extend_from_slice(&54u32.to_le_bytes());
                file.extend_from_slice(&40u32.to_le_bytes());
                file.extend_from_slice(&w.to_le_bytes());
                file.extend_from_slice(&(-h).to_le_bytes());
                file.extend_from_slice(&1u16.to_le_bytes());
                file.extend_from_slice(&32u16.to_le_bytes());
                file.extend_from_slice(&[0u8; 24]);
                file.extend_from_slice(&pixels);
                let _ = std::fs::write(self.dir.join(format!("{}-{label}.bmp", self.stamp)), file);
            }
            let mut log = self.log.into_inner();
            log.push_str(&format!("area {:?}\n", self.area));
            let _ = std::fs::write(self.dir.join(format!("{}.txt", self.stamp)), log);
        }
    }
}

#[cfg(windows)]
pub use native::{prewarm, Morph};

#[cfg(windows)]
mod native {
    use super::*;
    use std::cell::Cell;
    use std::sync::Mutex;
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, SIZE, WPARAM},
        Graphics::Dwm::{
            DwmFlush, DwmGetWindowAttribute, DwmRegisterThumbnail, DwmSetWindowAttribute,
            DwmUnregisterThumbnail, DwmUpdateThumbnailProperties, DWMWA_CLOAK,
            DWMWA_EXTENDED_FRAME_BOUNDS, DWMWA_TRANSITIONS_FORCEDISABLED, DWM_THUMBNAIL_PROPERTIES,
            DWM_TNP_OPACITY, DWM_TNP_RECTDESTINATION, DWM_TNP_SOURCECLIENTAREAONLY, DWM_TNP_VISIBLE,
        },
        Graphics::Gdi::{
            CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, SelectObject, AC_SRC_ALPHA,
            AC_SRC_OVER, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, BLENDFUNCTION, DIB_RGB_COLORS,
        },
        System::LibraryLoader::GetModuleHandleW,
        UI::HiDpi::GetDpiForWindow,
        UI::WindowsAndMessaging::{
            CreateWindowExW, DefWindowProcW, DestroyWindow, GetForegroundWindow, RegisterClassExW, ShowWindow,
            IsZoomed, UpdateLayeredWindow, HTTRANSPARENT, SW_SHOWNOACTIVATE, ULW_ALPHA, WM_NCHITTEST,
            WNDCLASSEXW, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_NOREDIRECTIONBITMAP,
            WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
        },
    };

    unsafe extern "system" fn procedure(hwnd: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        // Never takes input: the pointer reaches whatever is underneath.
        if message == WM_NCHITTEST {
            return HTTRANSPARENT as LRESULT;
        }
        DefWindowProcW(hwnd, message, wparam, lparam)
    }

    fn class() -> Result<Vec<u16>, String> {
        use std::sync::OnceLock;
        static REGISTERED: OnceLock<bool> = OnceLock::new();
        let name: Vec<u16> = "StashDockHandoff\0".encode_utf16().collect();
        let ok = *REGISTERED.get_or_init(|| unsafe {
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

    fn window(ex_style: u32, area: Rect) -> Result<HWND, String> {
        let class = class()?;
        let hwnd = unsafe {
            CreateWindowExW(
                ex_style,
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
            )
        };
        if hwnd.is_null() {
            Err("Could not prepare the window transition.".into())
        } else {
            Ok(hwnd)
        }
    }

    fn set_flag(hwnd: HWND, attribute: i32, on: bool) {
        let value: i32 = i32::from(on);
        unsafe {
            DwmSetWindowAttribute(hwnd, attribute as u32, (&value as *const i32).cast(), 4);
        }
    }

    /// What DWM draws (and thumbnails show) of a window: without the
    /// invisible resize borders of a framed window.
    fn visible_bounds(hwnd: HWND, fallback: Rect) -> Rect {
        let mut r = RECT { left: 0, top: 0, right: 0, bottom: 0 };
        let ok = unsafe {
            DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS as u32, (&mut r as *mut RECT).cast(), std::mem::size_of::<RECT>() as u32)
        } >= 0;
        if ok && r.right > r.left && r.bottom > r.top {
            Rect { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
        } else {
            fallback
        }
    }

    type Image = (i32, i32, i32, Vec<u8>);
    type Key = (i32, i32, u32, bool);
    /// The rendered shadows (active and inactive) for the panel's last size.
    static CACHE: Mutex<Vec<(Key, std::sync::Arc<Image>)>> = Mutex::new(Vec::new());

    fn key(panel: Rect, scale: f64, active: bool) -> Key {
        (panel.right - panel.left, panel.bottom - panel.top, (scale * 1000.0).round() as u32, active)
    }

    fn cached(key: Key) -> Option<std::sync::Arc<Image>> {
        CACHE.lock().unwrap_or_else(|e| e.into_inner()).iter().find(|(k, _)| *k == key).map(|(_, image)| image.clone())
    }

    fn render(key: Key) -> std::sync::Arc<Image> {
        let scale = key.2 as f64 / 1000.0;
        let image = std::sync::Arc::new(shadow::render(key.0, key.1, scale, key.3));
        let mut cache = CACHE.lock().unwrap_or_else(|e| e.into_inner());
        cache.retain(|(k, _)| *k != key && (k.0, k.1, k.2) == (key.0, key.1, key.2));
        cache.push((key, image.clone()));
        image
    }

    fn scale_of(hwnd: HWND) -> f64 {
        match unsafe { GetDpiForWindow(hwnd) } {
            0 => 1.0,
            dpi => dpi as f64 / 144.0,
        }
    }

    /// Renders the shadow for the panel's current size in the background, so
    /// the next collapse starts at once.
    pub fn prewarm(panel_hwnd: isize) {
        use std::sync::atomic::{AtomicBool, Ordering};
        static BUSY: AtomicBool = AtomicBool::new(false);
        let hwnd = panel_hwnd as HWND;
        if unsafe { IsZoomed(hwnd) } != 0 {
            return;
        }
        let panel = visible_bounds(hwnd, Rect { left: 0, top: 0, right: 0, bottom: 0 });
        if panel.width() < 144.0 || panel.height() < 144.0 {
            return;
        }
        let scale = scale_of(hwnd);
        let keys = [key(panel, scale, true), key(panel, scale, false)];
        if keys.iter().all(|k| cached(*k).is_some()) {
            return;
        }
        if BUSY.swap(true, Ordering::SeqCst) {
            return;
        }
        std::thread::spawn(move || {
            for key in keys {
                if cached(key).is_none() {
                    render(key);
                }
            }
            BUSY.store(false, Ordering::SeqCst);
        });
    }

    /// A cloaked layered window holding the panel's shadow, shown only through
    /// its thumbnail. The pixels are kept for the next transition at the same
    /// size and scale.
    struct ShadowSource {
        hwnd: HWND,
        margin: i32,
    }

    impl ShadowSource {
        fn new(panel: Rect, scale: f64, active: bool) -> Result<ShadowSource, String> {
            let key = key(panel, scale, active);
            let image = cached(key).unwrap_or_else(|| render(key));
            let (w, h, margin, pixels) = (image.0, image.1, image.2, &image.3);
            let area = Rect { left: panel.left - margin, top: panel.top - margin, right: panel.left - margin + w, bottom: panel.top - margin + h };
            let hwnd = window(WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT, area)?;
            let source = ShadowSource { hwnd, margin };
            set_flag(hwnd, DWMWA_TRANSITIONS_FORCEDISABLED, true);
            set_flag(hwnd, DWMWA_CLOAK, true);
            unsafe {
                let mut info: BITMAPINFO = std::mem::zeroed();
                info.bmiHeader = BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: w,
                    biHeight: -h,
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB,
                    ..std::mem::zeroed()
                };
                let mut bits: *mut core::ffi::c_void = std::ptr::null_mut();
                let memory = CreateCompatibleDC(std::ptr::null_mut());
                let bitmap = CreateDIBSection(memory, &info, DIB_RGB_COLORS, &mut bits, std::ptr::null_mut(), 0);
                if bitmap.is_null() || bits.is_null() {
                    DeleteDC(memory);
                    return Err("Could not draw the window transition.".into());
                }
                std::ptr::copy_nonoverlapping(pixels.as_ptr(), bits.cast::<u8>(), pixels.len());
                let old = SelectObject(memory, bitmap);
                let origin = POINT { x: 0, y: 0 };
                let at = POINT { x: area.left, y: area.top };
                let size = SIZE { cx: w, cy: h };
                let blend = BLENDFUNCTION { BlendOp: AC_SRC_OVER as u8, BlendFlags: 0, SourceConstantAlpha: 255, AlphaFormat: AC_SRC_ALPHA as u8 };
                let ok = UpdateLayeredWindow(hwnd, std::ptr::null_mut(), &at, &size, memory, &origin, 0, &blend, ULW_ALPHA);
                SelectObject(memory, old);
                DeleteObject(bitmap);
                DeleteDC(memory);
                if ok == 0 {
                    return Err("Could not draw the window transition.".into());
                }
                ShowWindow(hwnd, SW_SHOWNOACTIVATE);
            }
            Ok(source)
        }
    }

    impl Drop for ShadowSource {
        fn drop(&mut self) {
            unsafe {
                DestroyWindow(self.hwnd);
            }
        }
    }

    /// The live overlay. Must be created, finished and dropped on the UI thread.
    pub struct Morph {
        hwnd: HWND,
        origin: (i32, i32),
        shadow: Option<(ShadowSource, isize)>,
        panel_thumb: isize,
        folder_thumb: isize,
        direction: Direction,
        /// Visible bounds, which is what the thumbnails draw.
        panel: Rect,
        folder: Rect,
        /// Which windows the overlay draws: until `take_over` it draws
        /// nothing, so no frame ever shows a real window and its thumbnail
        /// (or both shadows) at once; after `hand_over` nothing again.
        drawing: Cell<bool>,
        #[cfg(debug_assertions)]
        probe: Option<super::probe::Probe>,
    }

    impl Morph {
        pub fn begin(panel_hwnd: isize, folder_hwnd: isize, panel: Rect, folder: Rect, direction: Direction) -> Result<Morph, String> {
            let (panel_hwnd, folder_hwnd) = (panel_hwnd as HWND, folder_hwnd as HWND);
            let panel = visible_bounds(panel_hwnd, panel);
            let folder = visible_bounds(folder_hwnd, folder);
            let scale = scale_of(panel_hwnd);
            // Cover both resting places, the panel's shadow and the folder's
            // grown/shrunk size.
            let reach = (shadow::REACH * scale).ceil() as i32;
            let margin = (folder.width() * 0.3).round() as i32;
            let area = Rect::union(
                Rect { left: panel.left - reach, top: panel.top - reach, right: panel.right + reach, bottom: panel.bottom + reach },
                Rect { left: folder.left - margin, top: folder.top - margin, right: folder.right + margin, bottom: folder.bottom + margin },
            );
            #[cfg(debug_assertions)]
            let probe = super::probe::Probe::open(area, direction);
            #[cfg(debug_assertions)]
            if let Some(probe) = probe.as_ref() {
                probe.note(format!("panel visible {panel:?} folder visible {folder:?} scale {scale}"));
                probe.shot("a-before", false);
            }
            let hwnd = window(WS_EX_TOOLWINDOW | WS_EX_TOPMOST | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT | WS_EX_NOREDIRECTIONBITMAP, area)?;
            let mut morph = Morph {
                hwnd,
                origin: (area.left, area.top),
                shadow: None,
                panel_thumb: 0,
                folder_thumb: 0,
                direction,
                panel,
                folder,
                drawing: Cell::new(false),
                #[cfg(debug_assertions)]
                probe,
            };
            unsafe {
                // Registration order is drawing order: shadow, panel, folder
                // (the folder's real window is topmost).
                // Drawn as the panel will look: active once it lands, or as it
                // is when it is collapsed.
                let active = direction == Direction::Expand || GetForegroundWindow() == panel_hwnd;
                match ShadowSource::new(panel, scale, active) {
                    Ok(source) => {
                        let mut thumb = 0;
                        if DwmRegisterThumbnail(hwnd, source.hwnd, &mut thumb) >= 0 {
                            morph.shadow = Some((source, thumb));
                        }
                    }
                    Err(error) => eprintln!("StashDock transition without shadow: {error}"),
                }
                if DwmRegisterThumbnail(hwnd, panel_hwnd, &mut morph.panel_thumb) < 0
                    || DwmRegisterThumbnail(hwnd, folder_hwnd, &mut morph.folder_thumb) < 0
                {
                    return Err("Could not prepare the window transition.".into());
                }
                // Shown empty; `take_over` starts drawing.
                ShowWindow(hwnd, SW_SHOWNOACTIVATE);
                DwmFlush();
            }
            Ok(morph)
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

        /// Starts drawing the source window in place and immediately hides the
        /// real one (`cloak`), back to back, so DWM composes the switch in one
        /// frame: never both at once, never neither.
        pub fn take_over<T>(&self, cloak: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
            self.drawing.set(true);
            self.show(0.0)?;
            cloak()
        }

        /// The reverse at the end: stops drawing and immediately reveals the
        /// real destination (`reveal`). Later calls only reveal.
        pub fn hand_over<T>(&self, reveal: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
            if self.drawing.replace(false) {
                let hidden = Rect { left: 0, top: 0, right: 1, bottom: 1 };
                if let Some((_, thumb)) = self.shadow.as_ref() {
                    self.place(*thumb, hidden, 0)?;
                }
                self.place(self.panel_thumb, hidden, 0)?;
                self.place(self.folder_thumb, hidden, 0)?;
            }
            reveal()
        }

        fn show(&self, t: f64) -> Result<(), String> {
            if !self.drawing.get() {
                return Ok(());
            }
            let frame = frame(self.direction, self.panel, self.folder, t);
            if let Some((source, thumb)) = self.shadow.as_ref() {
                // The shadow travels and fades with the panel.
                let sx = frame.panel.width() / self.panel.width().max(1.0);
                let sy = frame.panel.height() / self.panel.height().max(1.0);
                let m = source.margin as f64;
                let rect = Rect {
                    left: (frame.panel.left as f64 - m * sx).round() as i32,
                    top: (frame.panel.top as f64 - m * sy).round() as i32,
                    right: (frame.panel.right as f64 + m * sx).round() as i32,
                    bottom: (frame.panel.bottom as f64 + m * sy).round() as i32,
                };
                self.place(*thumb, rect, frame.panel_opacity)?;
            }
            self.place(self.panel_thumb, frame.panel, frame.panel_opacity)?;
            self.place(self.folder_thumb, frame.folder, frame.folder_opacity)
        }

        /// Plays the whole transition, one step per composed frame. Blocks the
        /// UI thread for its fraction of a second, as the direct handoff does
        /// for its native calls; WebView rendering continues in its own process.
        pub fn play(&self) -> Result<(), String> {
            let duration = self.direction.duration();
            #[cfg(debug_assertions)]
            if let Some(probe) = self.probe.as_ref() {
                probe.note(format!("shadow thumbnail {}", self.shadow.is_some()));
                unsafe {
                    DwmFlush();
                }
                probe.shot("b-first", false);
            }
            let start = Instant::now();
            for _step in 0..240 {
                let t = start.elapsed().as_secs_f64() / duration.as_secs_f64();
                self.show(t.min(1.0))?;
                if t >= 1.0 {
                    break;
                }
                if unsafe { DwmFlush() } < 0 {
                    std::thread::sleep(Duration::from_millis(8));
                }
                #[cfg(debug_assertions)]
                if let Some(probe) = self.probe.as_ref() {
                    probe.shot(&format!("m{:02}-t{:03}", _step, (t * 1000.0) as u32), true);
                }
            }
            #[cfg(debug_assertions)]
            if let Some(probe) = self.probe.as_ref() {
                unsafe {
                    DwmFlush();
                }
                probe.shot("y-last", false);
            }
            Ok(())
        }

        /// Wait until the real windows' revealed state has been composed, so
        /// removing the overlay never leaves an empty frame. Called after the
        /// destination took focus, so the real shadow is its active one.
        #[allow(unused_mut)]
        pub fn finish(mut self) {
            unsafe {
                DwmFlush();
            }
            #[cfg(debug_assertions)]
            let probe = self.probe.take();
            #[cfg(debug_assertions)]
            if let Some(probe) = probe.as_ref() {
                probe.shot("z0-revealed-under-overlay", false);
            }
            drop(self);
            #[cfg(debug_assertions)]
            if let Some(probe) = probe {
                unsafe {
                    DwmFlush();
                }
                probe.shot("z1-after", false);
                for _ in 0..3 {
                    unsafe {
                        DwmFlush();
                    }
                }
                probe.shot("z2-after-3", false);
                std::thread::sleep(Duration::from_millis(300));
                probe.shot("z3-after-300ms", false);
                probe.save();
            }
        }
    }

    impl Drop for Morph {
        fn drop(&mut self) {
            unsafe {
                if self.panel_thumb != 0 {
                    DwmUnregisterThumbnail(self.panel_thumb);
                }
                if self.folder_thumb != 0 {
                    DwmUnregisterThumbnail(self.folder_thumb);
                }
                if let Some((_, thumb)) = self.shadow.as_ref() {
                    DwmUnregisterThumbnail(*thumb);
                }
                self.shadow.take();
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
    fn the_shadow_matches_the_measured_panel_shadow_and_never_covers_it() {
        // Measured at 150% around a 1608x1070 panel (alpha over white).
        let image = shadow::render(1608, 1070, 1.0, true);
        let at = |x, y| shadow::alpha_at(&image, x, y);
        assert_eq!(at(800, 500), 0.0);
        assert_eq!(at(0, 0), 0.0);
        for (x, y, measured) in [(800, 1080, 0.271), (800, 1110, 0.152), (800, 1138, 0.066), (-10, 520, 0.119), (-40, 520, 0.019), (1612, 200, 0.106), (1612, 900, 0.167)] {
            assert!((at(x, y) - measured).abs() < 0.02, "({x}, {y}): {} vs {measured}", at(x, y));
        }
        let inactive = shadow::render(1608, 1070, 1.0, false);
        for (x, y, measured) in [(800, 1080, 0.173), (800, 1110, 0.097), (-10, 520, 0.063), (-40, 520, 0.008), (1612, 200, 0.069)] {
            let value = shadow::alpha_at(&inactive, x, y);
            assert!((value - measured).abs() < 0.02, "inactive ({x}, {y}): {value} vs {measured}");
        }
        // It scales with DPI.
        let small = shadow::render(1072, 713, 2.0 / 3.0, true);
        assert_eq!(small.2, 94);
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
