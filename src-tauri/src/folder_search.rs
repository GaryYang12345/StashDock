//! The folder's quick search: a transparent topmost window beside the
//! folder that only exists while the folder is the visible surface.
//!
//! It never steals focus. Shown, it stays non-activating until the user clicks
//! its search field; closing hands focus back to the window that had it. Its
//! window region covers only the visible field and cards, so transparent parts
//! never swallow clicks, and a closed search has no region at all. Hover intent
//! from the folder and the search is combined here, with one delay both ways.
use crate::window_geometry::{self, SearchPlacement, WorkArea};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

const LABEL: &str = "search";
/// One intent delay both ways: a passing pointer neither opens nor closes it.
const INTENT: Duration = Duration::from_millis(180);
/// If the search's own exit animation never reports back, still release input.
const EXIT_FALLBACK: Duration = Duration::from_millis(700);
const MAX_REGION_RECTS: usize = 8;

#[derive(Default)]
struct Search {
    /// The folder is the visible surface, so the search may open.
    attached: bool,
    open: bool,
    folder_hover: bool,
    search_hover: bool,
    /// Typing, a query or a drag keeps it open after the pointer leaves.
    held: bool,
    /// The user clicked into the field, so the search owns keyboard focus.
    focused: bool,
    /// The window that had focus before the field took it.
    previous: Option<isize>,
    /// Activation needed the non-activating style lifted; it is restored only
    /// once nothing is visible, since a style change redraws the frame.
    raised: bool,
    generation: u64,
    /// Counts closes, so an exit fallback only releases its own close.
    closes: u64,
    placement: Option<SearchPlacement>,
}

#[derive(Default)]
pub struct FolderSearchState(Mutex<Search>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderSearchStatus {
    pub open: bool,
    pub upward: bool,
    /// Physical pixels from the window's left edge; None before the first placement.
    pub anchor_px: Option<f64>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RegionRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

fn search_state(app: &AppHandle) -> Option<tauri::State<'_, FolderSearchState>> {
    app.try_state::<FolderSearchState>()
}
fn search_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(LABEL)
}
fn status_of(inner: &Search) -> FolderSearchStatus {
    FolderSearchStatus {
        open: inner.open,
        upward: inner.placement.is_none_or(|p| p.upward),
        anchor_px: inner.placement.map(|p| p.anchor_px),
    }
}
fn publish(app: &AppHandle) {
    let Some(state) = search_state(app) else { return };
    let status = status_of(&state.0.lock().unwrap_or_else(|e| e.into_inner()));
    let _ = app.emit("folder-search-state", status);
}

/// Called by the window lifecycle whenever the folder becomes the visible
/// surface. The window is made visible with an empty region (nothing drawn,
/// nothing hit-testable) before the folder takes focus.
pub fn attach(app: &AppHandle) -> Result<(), String> {
    let Some(window) = search_window(app) else { return Ok(()) };
    set_region(&window, &[])?;
    if !window.is_visible().map_err(|e| e.to_string())? {
        crate::window_frame::show_immediately(&window)?;
    }
    if let Some(state) = search_state(app) {
        state.0.lock().unwrap_or_else(|e| e.into_inner()).attached = true;
    }
    Ok(())
}

/// Called when the folder stops being the visible surface (or starts moving).
pub fn detach(app: &AppHandle, hide: bool) {
    close_now(app, true);
    if let Some(state) = search_state(app) {
        let mut inner = state.0.lock().unwrap_or_else(|e| e.into_inner());
        inner.attached = !hide && inner.attached;
        inner.folder_hover = false;
        inner.search_hover = false;
        inner.held = false;
        inner.generation += 1;
    }
    if hide {
        if let Some(window) = search_window(app) {
            if window.is_visible().unwrap_or(false) {
                let _ = crate::window_frame::hide_immediately(&window);
            }
        }
    }
}

fn evaluate(app: &AppHandle) {
    let Some(state) = search_state(app) else { return };
    let (want, generation) = {
        let mut inner = state.0.lock().unwrap_or_else(|e| e.into_inner());
        inner.generation += 1;
        let want = inner.attached && (inner.folder_hover || inner.search_hover || inner.held);
        if want == inner.open {
            return;
        }
        (want, inner.generation)
    };
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(INTENT);
        let copy = app.clone();
        let _ = app.run_on_main_thread(move || {
            let Some(state) = search_state(&copy) else { return };
            let current = state.0.lock().unwrap_or_else(|e| e.into_inner()).generation;
            if current != generation {
                return;
            }
            if want {
                if let Err(error) = open_now(&copy) {
                    eprintln!("Could not open the StashDock search: {error}");
                }
            } else {
                close_now(&copy, false);
            }
        });
    });
}

fn open_now(app: &AppHandle) -> Result<(), String> {
    let folder = app
        .get_webview_window("folder")
        .ok_or("Folder is unavailable")?;
    let window = search_window(app).ok_or("The folder search is unavailable")?;
    if !folder.is_visible().map_err(|e| e.to_string())? {
        return Ok(());
    }
    let position = folder.outer_position().map_err(|e| e.to_string())?;
    let size = folder.outer_size().map_err(|e| e.to_string())?;
    let centre = (
        position.x as f64 + size.width as f64 / 2.0,
        position.y as f64 + size.height as f64 / 2.0,
    );
    let monitor = folder
        .available_monitors()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|m| {
            let a = m.work_area();
            centre.0 >= a.position.x as f64
                && centre.1 >= a.position.y as f64
                && centre.0 < (a.position.x + a.size.width as i32) as f64
                && centre.1 < (a.position.y + a.size.height as i32) as f64
        })
        .or(folder.current_monitor().map_err(|e| e.to_string())?)
        .ok_or("Display is unavailable")?;
    let work = monitor.work_area();
    let placement = window_geometry::search_placement(
        (position.x, position.y),
        size.width as f64,
        WorkArea {
            x: work.position.x,
            y: work.position.y,
            width: work.size.width,
            height: work.size.height,
            scale: monitor.scale_factor(),
        },
    );
    place(&window, placement)?;
    if let Some(state) = search_state(app) {
        let mut inner = state.0.lock().unwrap_or_else(|e| e.into_inner());
        inner.open = true;
        inner.placement = Some(placement);
    }
    publish(app);
    Ok(())
}

/// Starts closing. The search plays its exit, then reports `folder_search_closed`, which
/// removes its region; `immediate` (mode changes, folder drags) skips that.
fn close_now(app: &AppHandle, immediate: bool) {
    let Some(state) = search_state(app) else { return };
    let (was_open, focused, previous, close) = {
        let mut inner = state.0.lock().unwrap_or_else(|e| e.into_inner());
        inner.closes += 1;
        let result = (inner.open, inner.focused, inner.previous.take(), inner.closes);
        inner.open = false;
        inner.focused = false;
        inner.held = false;
        result
    };
    if let Some(window) = search_window(app) {
        if focused {
            restore_focus(&window, previous);
        }
        if immediate {
            release(app, &window);
        }
    }
    if was_open {
        publish(app);
    }
    if was_open && !immediate {
        let app = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(EXIT_FALLBACK);
            let copy = app.clone();
            let _ = app.run_on_main_thread(move || release_if_closed(&copy, close));
        });
    }
}

fn release_if_closed(app: &AppHandle, close: u64) {
    let Some(state) = search_state(app) else { return };
    let inner = state.0.lock().unwrap_or_else(|e| e.into_inner());
    if !inner.open && inner.closes == close {
        drop(inner);
        if let Some(window) = search_window(app) {
            release(app, &window);
        }
    }
}

/// Nothing is visible any more: remove the region, then (invisibly) restore
/// the non-activating style if the field had to lift it.
fn release(app: &AppHandle, window: &WebviewWindow) {
    let _ = set_region(window, &[]);
    let raised = search_state(app).is_some_and(|s| {
        let mut inner = s.0.lock().unwrap_or_else(|e| e.into_inner());
        std::mem::take(&mut inner.raised)
    });
    if raised {
        let _ = window.set_focusable(false);
    }
}

/// Hand keyboard focus back to the window the user was typing in.
fn restore_focus(window: &WebviewWindow, previous: Option<isize>) {
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            GetForegroundWindow, IsWindow, SetForegroundWindow,
        };
        let own = window.hwnd().map(|h| h.0 as isize).unwrap_or_default();
        if GetForegroundWindow() as isize == own {
            if let Some(previous) = previous.filter(|p| IsWindow(*p as _) != 0) {
                SetForegroundWindow(previous as _);
            }
        }
    }
    let _ = (window, previous);
}

/// Position, size and lift above the folder in one native call, without
/// activating or changing framework visibility.
fn place(window: &WebviewWindow, placement: SearchPlacement) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOOWNERZORDER,
        };
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as _;
        // Moving first lets Windows apply a new monitor's DPI; the size is then
        // set for that monitor so it is never scaled twice.
        for _ in 0..2 {
            if unsafe {
                SetWindowPos(
                    hwnd,
                    HWND_TOPMOST,
                    placement.x,
                    placement.y,
                    placement.width as i32,
                    placement.height as i32,
                    SWP_NOACTIVATE | SWP_NOOWNERZORDER,
                )
            } == 0
            {
                return Err("Could not place the StashDock search.".into());
            }
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        window
            .set_position(tauri::PhysicalPosition::new(placement.x, placement.y))
            .map_err(|e| e.to_string())?;
        window
            .set_size(tauri::PhysicalSize::new(placement.width, placement.height))
            .map_err(|e| e.to_string())
    }
}

/// Clip the window (painting and hit-testing) to the given CSS-pixel rects.
fn set_region(window: &WebviewWindow, rects: &[RegionRect]) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::Graphics::Gdi::{
            CombineRgn, CreateRectRgn, DeleteObject, SetWindowRgn, RGN_OR,
        };
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as _;
        let scale = window.scale_factor().map_err(|e| e.to_string())?;
        let size = window.inner_size().map_err(|e| e.to_string())?;
        unsafe {
            let region = CreateRectRgn(0, 0, 0, 0);
            if region.is_null() {
                return Err("Could not update the StashDock search area.".into());
            }
            for rect in rects {
                let left = (rect.x * scale).floor().clamp(0.0, size.width as f64) as i32;
                let top = (rect.y * scale).floor().clamp(0.0, size.height as f64) as i32;
                let right = ((rect.x + rect.width) * scale).ceil().clamp(0.0, size.width as f64) as i32;
                let bottom = ((rect.y + rect.height) * scale).ceil().clamp(0.0, size.height as f64) as i32;
                if right <= left || bottom <= top {
                    continue;
                }
                let part = CreateRectRgn(left, top, right, bottom);
                if !part.is_null() {
                    CombineRgn(region, region, part, RGN_OR);
                    DeleteObject(part);
                }
            }
            // On success the system owns the region.
            if SetWindowRgn(hwnd, region, 1) == 0 {
                DeleteObject(region);
                return Err("Could not update the StashDock search area.".into());
            }
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (window, rects);
        Ok(())
    }
}

fn require(window: &WebviewWindow, labels: &[&str]) -> Result<(), String> {
    if labels.contains(&window.label()) {
        Ok(())
    } else {
        Err("This operation is only available to the StashDock folder.".into())
    }
}

/// Pointer entered or left the folder or the search.
#[tauri::command]
pub fn folder_search_pointer(window: WebviewWindow, inside: bool) -> Result<(), String> {
    require(&window, &["folder", LABEL])?;
    let app = window.app_handle();
    if let Some(state) = search_state(app) {
        let mut inner = state.0.lock().unwrap_or_else(|e| e.into_inner());
        if window.label() == LABEL {
            inner.search_hover = inside;
        } else {
            inner.folder_hover = inside;
        }
    }
    evaluate(app);
    Ok(())
}

/// The search is being used (field focused, a query typed or a card dragged).
#[tauri::command]
pub fn folder_search_hold(window: WebviewWindow, held: bool) -> Result<(), String> {
    require(&window, &[LABEL])?;
    let app = window.app_handle();
    if let Some(state) = search_state(app) {
        state.0.lock().unwrap_or_else(|e| e.into_inner()).held = held;
    }
    evaluate(app);
    Ok(())
}

/// Escape, or a completed action that should put the search away.
#[tauri::command]
pub fn folder_search_close(window: WebviewWindow) -> Result<(), String> {
    require(&window, &[LABEL])?;
    let app = window.app_handle().clone();
    let copy = app.clone();
    app.run_on_main_thread(move || {
        if let Some(state) = search_state(&copy) {
            let mut inner = state.0.lock().unwrap_or_else(|e| e.into_inner());
            inner.generation += 1;
            inner.search_hover = false;
            inner.folder_hover = false;
        }
        close_now(&copy, false);
    })
    .map_err(|e| e.to_string())
}

/// The user pressed the field: let the search take keyboard focus now.
#[tauri::command]
pub async fn folder_search_focus(window: WebviewWindow) -> Result<(), String> {
    require(&window, &[LABEL])?;
    let (send, receive) = std::sync::mpsc::sync_channel(1);
    let copy = window.clone();
    window
        .run_on_main_thread(move || {
            let app = copy.app_handle();
            let result = (|| {
                let state = search_state(app).ok_or("The folder search is unavailable")?;
                if !state.0.lock().unwrap_or_else(|e| e.into_inner()).open {
                    return Ok(());
                }
                #[cfg(windows)]
                let previous = unsafe {
                    let foreground =
                        windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow() as isize;
                    let own = copy.hwnd().map(|h| h.0 as isize).unwrap_or_default();
                    (foreground != 0 && foreground != own).then_some(foreground)
                };
                #[cfg(not(windows))]
                let previous = None;
                {
                    let mut inner = state.0.lock().unwrap_or_else(|e| e.into_inner());
                    if !inner.focused {
                        inner.previous = previous;
                    }
                    inner.focused = true;
                }
                // A non-activating window can still be activated on request;
                // only if Windows refuses is the style lifted (until closed).
                copy.set_focus().map_err(|e| e.to_string())?;
                #[cfg(windows)]
                let active = unsafe {
                    windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow() as isize
                        == copy.hwnd().map(|h| h.0 as isize).unwrap_or_default()
                };
                #[cfg(not(windows))]
                let active = true;
                if !active {
                    state.0.lock().unwrap_or_else(|e| e.into_inner()).raised = true;
                    copy.set_focusable(true).map_err(|e| e.to_string())?;
                    copy.set_focus().map_err(|e| e.to_string())?;
                }
                Ok(())
            })();
            let _ = send.send(result);
        })
        .map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || receive.recv().map_err(|e| e.to_string())?)
        .await
        .map_err(|e| e.to_string())?
}

/// The visible field and cards, in CSS pixels, so only they take input.
#[tauri::command]
pub fn folder_search_region(window: WebviewWindow, rects: Vec<RegionRect>) -> Result<(), String> {
    require(&window, &[LABEL])?;
    if rects.len() > MAX_REGION_RECTS
        || rects.iter().any(|r| {
            [r.x, r.y, r.width, r.height]
                .iter()
                .any(|v| !v.is_finite() || v.abs() > 10_000.0)
        })
    {
        return Err("Invalid search area.".into());
    }
    let open = search_state(window.app_handle())
        .is_some_and(|s| s.0.lock().unwrap_or_else(|e| e.into_inner()).open);
    // A late report from a closing search must not give it input again.
    set_region(&window, if open { &rects } else { &[] })
}

/// The exit animation finished.
#[tauri::command]
pub fn folder_search_closed(window: WebviewWindow) -> Result<(), String> {
    require(&window, &[LABEL])?;
    let app = window.app_handle();
    let open = search_state(app).is_some_and(|s| s.0.lock().unwrap_or_else(|e| e.into_inner()).open);
    if !open {
        release(app, &window);
    }
    Ok(())
}

#[tauri::command]
pub fn folder_search_status(window: WebviewWindow) -> Result<FolderSearchStatus, String> {
    require(&window, &["folder", LABEL])?;
    let state = search_state(window.app_handle()).ok_or("The folder search is unavailable")?;
    let status = status_of(&state.0.lock().unwrap_or_else(|e| e.into_inner()));
    Ok(status)
}

/// Open the library panel on the same search.
#[tauri::command]
pub async fn folder_search_open_library(window: WebviewWindow, query: String) -> Result<(), String> {
    require(&window, &[LABEL])?;
    if query.chars().count() > 500 {
        return Err("This search is too long.".into());
    }
    crate::desktop_windows::open_panel(window.app_handle()).await?;
    let _ = window.app_handle().emit_to("main", "library-search", query);
    Ok(())
}

/// Focus left the search (the user clicked elsewhere): put it away.
pub fn blurred(app: &AppHandle) {
    let Some(state) = search_state(app) else { return };
    let was_focused = {
        let mut inner = state.0.lock().unwrap_or_else(|e| e.into_inner());
        let focused = inner.focused;
        if focused {
            inner.focused = false;
            inner.previous = None;
            inner.held = false;
            inner.search_hover = false;
            inner.folder_hover = false;
            inner.generation += 1;
        }
        focused
    };
    if was_focused {
        close_now(app, false);
    }
}
