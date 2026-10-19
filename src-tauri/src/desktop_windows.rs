//! One lifecycle authority for two independent windows. UI is never the owner
//! of native bounds, Z-order or application lifetime.
use crate::window_frame;
use crate::window_geometry::{self, Geometry, SavedWindows, WorkArea};
use serde::{Deserialize, Serialize};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Surface {
    Panel,
    Folder,
}
impl Surface {
    fn label(self) -> &'static str {
        if self == Self::Panel {
            "main"
        } else {
            "folder"
        }
    }
}
#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub visible: Option<Surface>,
    pub requested: Option<Surface>,
    pub maximized: bool,
}
struct Inner {
    status: Status,
    last: Surface,
    panel_ready: bool,
    folder_ready: bool,
    saved: SavedWindows,
    expansion: Option<Expansion>,
    floating_enabled: bool,
}
/// Keep the pre-reveal folder separate from the panel's edge-clamped bounds.
/// This is transient handoff state, not another persisted window position.
#[derive(Clone, Copy)]
struct Expansion {
    folder: Geometry,
    panel_position: (i32, i32),
}
impl Expansion {
    fn return_folder(self, panel_position: (i32, i32)) -> Option<Geometry> {
        (self.panel_position == panel_position).then_some(self.folder)
    }
}
pub struct DesktopWindows {
    inner: Mutex<Inner>,
    path: PathBuf,
    writer: Mutex<Option<Vec<u8>>>,
    persistence: Persistence,
}
#[derive(Default)]
struct Persistence {
    dirty: AtomicBool,
    running: AtomicBool,
}
impl Persistence {
    fn request(&self) -> bool {
        self.dirty.store(true, Ordering::Release);
        !self.running.swap(true, Ordering::AcqRel)
    }
    fn take(&self) -> bool {
        self.dirty.swap(false, Ordering::AcqRel)
    }
    fn finish(&self) -> bool {
        self.running.store(false, Ordering::Release);
        self.dirty.load(Ordering::Acquire) && !self.running.swap(true, Ordering::AcqRel)
    }
}
fn status(app: &AppHandle) -> Status {
    app.state::<DesktopWindows>()
        .inner
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .status
}
fn emit(app: &AppHandle) {
    let _ = app.emit("desktop-window-state", status(app));
}
pub fn floating_enabled(app: &AppHandle) -> bool {
    app.try_state::<DesktopWindows>().is_none_or(|state| {
        state
            .inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .floating_enabled
    })
}
/// Called only by the serialized blocking settings worker. Native effects stay
/// on the UI thread; failed application leaves the prior policy unchanged.
pub fn set_floating_enabled(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let (send, receive) = std::sync::mpsc::sync_channel(1);
    let copy = app.clone();
    app.run_on_main_thread(move || {
        let result = (|| {
            if !enabled && status(&copy).visible == Some(Surface::Folder) {
                apply(&copy, Some(Surface::Panel))?;
            }
            let state = copy.state::<DesktopWindows>();
            let mut inner = state.inner.lock().unwrap_or_else(|e| e.into_inner());
            inner.floating_enabled = enabled;
            if !enabled {
                inner.last = Surface::Panel;
                inner.expansion = None;
            }
            Ok(())
        })();
        let _ = send.send(result);
    })
    .map_err(|e| e.to_string())?;
    receive.recv().map_err(|e| e.to_string())?
}
fn surface(window: &WebviewWindow) -> Result<Surface, String> {
    match window.label() {
        "main" => Ok(Surface::Panel),
        "folder" => Ok(Surface::Folder),
        _ => Err("Unsupported desktop surface".into()),
    }
}

fn configure(
    window: &WebviewWindow,
    saved: Option<Geometry>,
    folder: bool,
    resize: bool,
) -> Result<(), String> {
    let monitors = window.available_monitors().map_err(|e| e.to_string())?;
    let monitor = saved
        .and_then(|g| {
            monitors
                .iter()
                .find(|m| {
                    let a = m.work_area();
                    g.x >= a.position.x
                        && g.y >= a.position.y
                        && g.x < a.position.x + a.size.width as i32
                        && g.y < a.position.y + a.size.height as i32
                })
                .cloned()
        })
        .or(window.primary_monitor().map_err(|e| e.to_string())?)
        .or_else(|| monitors.first().cloned());
    if let Some(monitor) = monitor {
        let a = monitor.work_area();
        let area = WorkArea {
            x: a.position.x,
            y: a.position.y,
            width: a.size.width,
            height: a.size.height,
            scale: monitor.scale_factor(),
        };
        let g = window_geometry::clamp(saved, area, folder);
        if resize && !folder {
            window
                .set_min_size(Some(tauri::LogicalSize::new(
                    window_geometry::PANEL_MIN_WIDTH.min(g.width),
                    window_geometry::PANEL_MIN_HEIGHT.min(g.height),
                )))
                .map_err(|e| e.to_string())?;
        }
        // Do not repeatedly reapply native bounds. Reconfiguring a shadowed,
        // undecorated frame while its metrics settle can change client height.
        // Normal show/hide must never resize a window that already fits.
        let desired = tauri::PhysicalSize::new(
            (g.width * area.scale).round() as u32,
            (g.height * area.scale).round() as u32,
        );
        if resize && window.inner_size().map_err(|e| e.to_string())? != desired {
            window_frame::set_client_size(window, desired.width, desired.height)?;
        }
        let desired_position = tauri::PhysicalPosition::new(g.x, g.y);
        if window.outer_position().map_err(|e| e.to_string())? != desired_position {
            window
                .set_position(desired_position)
                .map_err(|e| e.to_string())?;
        }
    } else {
        window.center().map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub fn initialize(app: &AppHandle) -> Result<(), String> {
    let path = if let Some(directory) = std::env::var_os("STASHDOCK_DATA_DIR") {
        PathBuf::from(directory).join("window-state-v2.json")
    } else {
        app.path()
            .app_config_dir()
            .map_err(|e| e.to_string())?
            .join("window-state-v2.json")
    };
    let saved = std::fs::read(&path)
        .ok()
        .filter(|v| v.len() <= 65536)
        .and_then(|v| serde_json::from_slice::<SavedWindows>(&v).ok())
        .unwrap_or_default();
    app.manage(DesktopWindows {
        inner: Mutex::new(Inner {
            status: Status {
                visible: None,
                requested: Some(Surface::Panel),
                maximized: false,
            },
            last: Surface::Panel,
            panel_ready: false,
            folder_ready: false,
            saved: saved.clone(),
            expansion: None,
            floating_enabled: crate::settings::read(&app.state::<crate::library::LibraryState>())?
                .floating_window,
        }),
        path,
        writer: Mutex::new(None),
        persistence: Persistence::default(),
    });
    let main = app
        .get_webview_window("main")
        .ok_or("The panel window is missing")?;
    let folder = app
        .get_webview_window("folder")
        .ok_or("The folder window is missing")?;
    // A hidden Win32 window has not settled its non-client frame metrics yet.
    // Position now; restore the panel's client size once its real frame is live.
    configure(&main, saved.panel, false, false)?;
    configure(&folder, saved.folder, true, false)?;
    main.set_always_on_top(false).map_err(|e| e.to_string())?;
    // A normally sized window is visible even if frontend loading fails. Never
    // leave the application trapped behind a hidden JavaScript-ready handshake.
    main.show().map_err(|e| e.to_string())?;
    main.set_focus().map_err(|e| e.to_string())?;
    app.state::<DesktopWindows>()
        .inner
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .status
        .visible = Some(Surface::Panel);
    Ok(())
}
pub fn remember(app: &AppHandle, window: &WebviewWindow) {
    let Some(state) = app.try_state::<DesktopWindows>() else {
        return;
    };
    let Ok(which) = surface(window) else { return };
    let ready = {
        let inner = state.inner.lock().unwrap_or_else(|e| e.into_inner());
        if which == Surface::Panel {
            inner.panel_ready
        } else {
            inner.folder_ready
        }
    };
    // Hidden/creation focus events must not replace the user's saved size
    // with pre-show frame metrics. Handoffs snapshot the live outgoing window.
    if !ready || !window.is_visible().unwrap_or(false) {
        return;
    }
    if window.is_maximized().unwrap_or(false) || window.is_minimized().unwrap_or(false) {
        return;
    }
    let (Ok(p), Ok(size), Ok(scale)) = (
        window.outer_position(),
        window.inner_size(),
        window.scale_factor(),
    ) else {
        return;
    };
    let g = Geometry {
        x: p.x,
        y: p.y,
        width: size.width as f64 / scale,
        height: size.height as f64 / scale,
    };
    if !window_geometry::fits(g) {
        return;
    }
    let mut inner = state.inner.lock().unwrap_or_else(|e| e.into_inner());
    if which == Surface::Panel {
        inner.saved.panel = Some(g);
    } else {
        inner.saved.folder = Some(g);
    }
}
fn write_settings(app: &AppHandle) {
    let Some(state) = app.try_state::<DesktopWindows>() else {
        return;
    };
    let mut previous = state.writer.lock().unwrap_or_else(|e| e.into_inner());
    let saved = state
        .inner
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .saved
        .clone();
    let result = (|| -> Result<(), Box<dyn std::error::Error>> {
        let bytes = serde_json::to_vec(&saved)?;
        if previous.as_ref() == Some(&bytes) {
            return Ok(());
        }
        std::fs::create_dir_all(state.path.parent().ok_or("Invalid settings path")?)?;
        let temporary = state.path.with_extension("tmp");
        std::fs::write(&temporary, &bytes)?;
        std::fs::rename(temporary, &state.path)?;
        *previous = Some(bytes);
        Ok(())
    })();
    if let Err(error) = result {
        eprintln!("Window preferences could not be saved: {error}");
    }
}
pub fn persist_later(app: &AppHandle) {
    let Some(state) = app.try_state::<DesktopWindows>() else {
        return;
    };
    if !state.persistence.request() {
        return;
    }
    let copy = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = copy.state::<DesktopWindows>();
        loop {
            if state.persistence.take() {
                write_settings(&copy);
            }
            if !state.persistence.finish() {
                break;
            }
        }
    });
}
pub fn persist_now(app: &AppHandle) {
    for label in ["main", "folder"] {
        if let Some(w) = app.get_webview_window(label) {
            remember(app, &w);
        }
    }
    write_settings(app);
}

/// Direct native show/hide. The two WebViews stay mounted, with no animation
/// state, temporary visual window or renderer completion handshake.
fn apply(app: &AppHandle, target: Option<Surface>) -> Result<Status, String> {
    let state = app.state::<DesktopWindows>();
    let old = {
        let mut inner = state.inner.lock().unwrap_or_else(|e| e.into_inner());
        inner.status.requested = target;
        inner.status.visible
    };
    if let Some(previous) = old {
        if let Some(window) = app.get_webview_window(previous.label()) {
            remember(app, &window);
        }
    }
    let result = (|| -> Result<(), String> {
        if let Some(next) = target {
            let window = app
                .get_webview_window(next.label())
                .ok_or("The requested window is unavailable")?;
            if old != target && !window.is_maximized().unwrap_or(false) {
                if old == Some(Surface::Folder) && next == Surface::Panel {
                    prepare_placement(app)?;
                } else if old == Some(Surface::Panel) && next == Surface::Folder {
                    prepare_folder_placement(app)?;
                } else {
                    let saved = state
                        .inner
                        .lock()
                        .unwrap_or_else(|e| e.into_inner())
                        .saved
                        .clone();
                    configure(
                        &window,
                        if next == Surface::Panel {
                            saved.panel
                        } else {
                            saved.folder
                        },
                        next == Surface::Folder,
                        next == Surface::Panel,
                    )?;
                }
            }
            window
                .set_always_on_top(next == Surface::Folder)
                .map_err(|e| e.to_string())?;
            if old != target {
                if let Some(previous) = old {
                    if let Some(outgoing) = app.get_webview_window(previous.label()) {
                        window_frame::hide_immediately(&outgoing)?;
                    }
                }
            }
            if window.is_minimized().unwrap_or(false) {
                window.unminimize().map_err(|e| e.to_string())?;
            }
            // Hide either outgoing surface first. The rollback below restores
            // the source if showing/focusing the destination fails.
            window.show().map_err(|e| e.to_string())?;
        }
        for surface in [Surface::Panel, Surface::Folder] {
            if Some(surface) != target {
                if let Some(window) = app.get_webview_window(surface.label()) {
                    window_frame::hide_immediately(&window)?;
                }
            }
        }
        if let Some(next) = target {
            app.get_webview_window(next.label())
                .ok_or("The requested window is unavailable")?
                .set_focus()
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    })();
    if let Err(error) = result {
        for surface in [Surface::Panel, Surface::Folder] {
            if let Some(window) = app.get_webview_window(surface.label()) {
                let _ = window.set_always_on_top(surface == Surface::Folder);
                if Some(surface) == old {
                    let _ = window.show();
                    let _ = window.set_focus();
                } else {
                    let _ = window_frame::hide_immediately(&window);
                }
            }
        }
        state
            .inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .status
            .requested = old;
        emit(app);
        return Err(error);
    }
    {
        let mut inner = state.inner.lock().unwrap_or_else(|e| e.into_inner());
        if old == Some(Surface::Folder) && target == Some(Surface::Panel) {
            // Read the actual settled native position, not the requested one.
            // Moving the panel later is the only reason to abandon this anchor.
            inner.expansion = inner.saved.folder.and_then(|folder| {
                app.get_webview_window("main")?
                    .outer_position()
                    .ok()
                    .map(|p| Expansion {
                        folder,
                        panel_position: (p.x, p.y),
                    })
            });
        } else if target == Some(Surface::Folder) && old != target {
            inner.expansion = None;
        }
        inner.status.visible = target;
        inner.status.maximized = app
            .get_webview_window("main")
            .is_some_and(|window| window.is_maximized().unwrap_or(false));
        if let Some(next) = target {
            inner.last = next;
        }
    }
    persist_later(app);
    emit(app);
    Ok(status(app))
}
fn prepare_placement(app: &AppHandle) -> Result<(), String> {
    let folder = app
        .get_webview_window("folder")
        .ok_or("Folder is unavailable")?;
    let panel = app
        .get_webview_window("main")
        .ok_or("Panel is unavailable")?;
    let position = folder.outer_position().map_err(|e| e.to_string())?;
    let scale = folder.scale_factor().map_err(|e| e.to_string())?;
    // Anchor to the actual native artwork square.
    let half = window_geometry::FOLDER_SIZE / 2.0;
    let center = (
        position.x as f64 + half * scale,
        position.y as f64 + half * scale,
    );
    if !panel.is_maximized().unwrap_or(false) {
        let monitors = folder.available_monitors().map_err(|e| e.to_string())?;
        let monitor = monitors
            .iter()
            .find(|m| {
                let a = m.work_area();
                center.0 >= a.position.x as f64
                    && center.1 >= a.position.y as f64
                    && center.0 < (a.position.x + a.size.width as i32) as f64
                    && center.1 < (a.position.y + a.size.height as i32) as f64
            })
            .cloned()
            .or(folder.current_monitor().map_err(|e| e.to_string())?)
            .ok_or("Display is unavailable")?;
        let a = monitor.work_area();
        let area = WorkArea {
            x: a.position.x,
            y: a.position.y,
            width: a.size.width,
            height: a.size.height,
            scale: monitor.scale_factor(),
        };
        let outer = panel.outer_size().map_err(|e| e.to_string())?;
        let inner = panel.inner_size().map_err(|e| e.to_string())?;
        let current_scale = panel.scale_factor().map_err(|e| e.to_string())?;
        let ratio = area.scale / current_scale;
        let gutters = (
            outer.width.saturating_sub(inner.width) as f64 * ratio,
            outer.height.saturating_sub(inner.height) as f64 * ratio,
        );
        let saved = app
            .state::<DesktopWindows>()
            .inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .saved
            .panel;
        let placed = window_geometry::anchored_panel(saved, area, center, gutters);
        configure(&panel, Some(placed), false, true)?;
        app.state::<DesktopWindows>()
            .inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .saved
            .panel = Some(placed);
    }
    Ok(())
}

fn prepare_folder_placement(app: &AppHandle) -> Result<(), String> {
    let panel = app
        .get_webview_window("main")
        .ok_or("Panel is unavailable")?;
    let folder = app
        .get_webview_window("folder")
        .ok_or("Folder is unavailable")?;
    let position = panel.outer_position().map_err(|e| e.to_string())?;
    let original = app
        .state::<DesktopWindows>()
        .inner
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .expansion
        .and_then(|origin| origin.return_folder((position.x, position.y)));
    if let Some(original) = original {
        // configure still clamps for a removed monitor or changed work area.
        configure(&folder, Some(original), true, false)?;
        app.state::<DesktopWindows>()
            .inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .saved
            .folder = Some(original);
        return Ok(());
    }
    let size = panel.outer_size().map_err(|e| e.to_string())?;
    let center = (
        position.x as f64 + size.width as f64 / 2.0,
        position.y as f64 + size.height as f64 / 2.0,
    );
    let monitors = panel.available_monitors().map_err(|e| e.to_string())?;
    let monitor = monitors
        .iter()
        .find(|monitor| {
            let area = monitor.work_area();
            center.0 >= area.position.x as f64
                && center.1 >= area.position.y as f64
                && center.0 < (area.position.x + area.size.width as i32) as f64
                && center.1 < (area.position.y + area.size.height as i32) as f64
        })
        .cloned()
        .or(panel.current_monitor().map_err(|e| e.to_string())?)
        .ok_or("Display is unavailable")?;
    let work = monitor.work_area();
    let area = WorkArea {
        x: work.position.x,
        y: work.position.y,
        width: work.size.width,
        height: work.size.height,
        scale: monitor.scale_factor(),
    };
    let placed = window_geometry::anchored_folder(area, center);
    configure(&folder, Some(placed), true, false)?;
    app.state::<DesktopWindows>()
        .inner
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .saved
        .folder = Some(placed);
    Ok(())
}

pub fn show_last(app: &AppHandle) {
    let copy = app.clone();
    let _ = app.run_on_main_thread(move || {
        let mut target = copy
            .state::<DesktopWindows>()
            .inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .last;
        if !floating_enabled(&copy) {
            target = Surface::Panel;
        }
        if let Err(error) = apply(&copy, Some(target)) {
            eprintln!("Could not reopen StashDock: {error}");
        }
    });
}
fn toggle_target(current: Status, last: Surface, minimized: bool) -> Surface {
    if minimized {
        return Surface::Panel;
    }
    match current.requested.or(current.visible) {
        Some(Surface::Panel) => Surface::Folder,
        Some(Surface::Folder) => Surface::Panel,
        None => last,
    }
}
pub fn toggle(app: &AppHandle) {
    let copy = app.clone();
    let _ = app.run_on_main_thread(move || {
        let current = status(&copy);
        let last = copy
            .state::<DesktopWindows>()
            .inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .last;
        let minimized = current.visible == Some(Surface::Panel)
            && copy
                .get_webview_window("main")
                .is_some_and(|w| w.is_minimized().unwrap_or(false));
        let target = if floating_enabled(&copy) {
            Some(toggle_target(current, last, minimized))
        } else if current.visible == Some(Surface::Panel) && !minimized {
            None
        } else {
            Some(Surface::Panel)
        };
        if let Err(error) = apply(&copy, target) {
            eprintln!("Could not switch StashDock: {error}");
        }
    });
}
pub fn hide(app: &AppHandle) {
    let copy = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Err(error) = apply(&copy, None) {
            eprintln!("Could not hide StashDock: {error}");
        }
    });
}
pub fn window_event(app: &AppHandle, window: &tauri::Window, event: &tauri::WindowEvent) {
    let Some(state) = app.try_state::<DesktopWindows>() else {
        return;
    };
    if let Some(webview) = app.get_webview_window(window.label()) {
        if matches!(event, tauri::WindowEvent::Focused(false)) {
            remember(app, &webview);
            persist_later(app);
        }
        if window.label() == "main" && matches!(event, tauri::WindowEvent::Resized(_)) {
            let maximized = webview.is_maximized().unwrap_or(false);
            let changed = {
                let mut inner = state.inner.lock().unwrap_or_else(|e| e.into_inner());
                let changed = inner.status.maximized != maximized;
                inner.status.maximized = maximized;
                changed
            };
            if changed {
                emit(app);
            }
        }
    }
}
async fn on_ui(
    app: AppHandle,
    action: impl FnOnce(&AppHandle) -> Result<Status, String> + Send + 'static,
) -> Result<Status, String> {
    let (send, receive) = std::sync::mpsc::sync_channel(1);
    let copy = app.clone();
    app.run_on_main_thread(move || {
        let _ = send.send(action(&copy));
    })
    .map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || receive.recv().map_err(|e| e.to_string())?)
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn desktop_window_status(window: WebviewWindow) -> Result<Status, String> {
    surface(&window)?;
    Ok(status(window.app_handle()))
}
#[tauri::command]
pub async fn set_desktop_surface(window: WebviewWindow, target: Surface) -> Result<Status, String> {
    surface(&window)?;
    on_ui(window.app_handle().clone(), move |app| {
        if target == Surface::Folder && !floating_enabled(app) {
            app.get_webview_window("main")
                .ok_or("Panel is unavailable")?
                .minimize()
                .map_err(|e| e.to_string())?;
            return Ok(status(app));
        }
        apply(app, Some(target))
    })
    .await
}
#[tauri::command]
pub async fn hide_stashdock(window: WebviewWindow) -> Result<Status, String> {
    surface(&window)?;
    on_ui(window.app_handle().clone(), |app| {
        if !floating_enabled(app) {
            app.exit(0);
            return Ok(status(app));
        }
        apply(app, None)
    })
    .await
}
#[tauri::command]
pub async fn desktop_window_ready(window: WebviewWindow) -> Result<Status, String> {
    let which = surface(&window)?;
    on_ui(window.app_handle().clone(), move |app| {
        let state = app.state::<DesktopWindows>();
        let (already_ready, requested, visible) = {
            let inner = state.inner.lock().unwrap_or_else(|e| e.into_inner());
            let already = if which == Surface::Panel {
                inner.panel_ready
            } else {
                inner.folder_ready
            };
            (already, inner.status.requested, inner.status.visible)
        };
        if which == Surface::Panel && !already_ready {
            let saved = state
                .inner
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .saved
                .panel;
            configure(
                &app.get_webview_window("main")
                    .ok_or("Panel is unavailable")?,
                saved,
                false,
                true,
            )?;
        }
        if !already_ready {
            let mut inner = state.inner.lock().unwrap_or_else(|e| e.into_inner());
            if which == Surface::Panel {
                inner.panel_ready = true;
            } else {
                inner.folder_ready = true;
            }
        }
        if requested == visible {
            Ok(status(app))
        } else {
            apply(app, requested)
        }
    })
    .await
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn persistence_coalesces_bursts_and_does_not_lose_late_requests() {
        let state = Persistence::default();
        assert!(state.request());
        for _ in 0..1000 {
            assert!(!state.request());
        }
        assert!(state.take());
        assert!(!state.take());
        assert!(!state.request()); // Arrived during the write.
        assert!(state.finish());
        assert!(state.take());
        assert!(!state.finish());
        assert!(state.request()); // Arrived after the worker released ownership.
        assert!(state.take());
        assert!(!state.finish());
    }
    #[test]
    fn edge_clamped_reveal_returns_to_original_folder_unless_panel_moves() {
        let origin = Expansion {
            folder: Geometry {
                x: 1750,
                y: 800,
                width: 160.0,
                height: 232.0,
            },
            panel_position: (700, 200),
        };
        let original = origin.return_folder((700, 200)).unwrap();
        assert_eq!((original.x, original.y), (1750, 800));
        assert!(origin.return_folder((701, 200)).is_none());
        assert!(origin.return_folder((-1200, -400)).is_none());
    }
    #[test]
    fn pending_switches_follow_latest_intent_and_tray_restores_last_form() {
        let state = |visible, requested| Status {
            visible,
            requested,
            maximized: false,
        };
        assert_eq!(
            toggle_target(
                state(Some(Surface::Panel), Some(Surface::Folder)),
                Surface::Panel,
                false
            ),
            Surface::Panel
        );
        assert_eq!(
            toggle_target(state(None, None), Surface::Folder, false),
            Surface::Folder
        );
        assert_eq!(
            toggle_target(
                state(Some(Surface::Panel), Some(Surface::Panel)),
                Surface::Panel,
                true
            ),
            Surface::Panel
        );
    }
}
