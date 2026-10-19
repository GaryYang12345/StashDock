//! Folder pointer dragging. Exact native bounds need no custom hit region.
use tauri::Manager;
fn require_folder(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "folder" {
        Ok(())
    } else {
        Err("This operation only supports the folder window".into())
    }
}
fn pointer_offset(
    cursor: (i32, i32),
    origin: (Option<f64>, Option<f64>),
    scale: f64,
) -> Option<(i32, i32)> {
    let (Some(x), Some(y)) = origin else {
        return None;
    };
    let dx = cursor.0 - (x * scale).round() as i32;
    let dy = cursor.1 - (y * scale).round() as i32;
    ((dx as f64).hypot(dy as f64) >= 5.0 * scale).then_some((dx, dy))
}

#[tauri::command]
pub async fn drag_folder_window(
    window: tauri::WebviewWindow,
    pointer_x: Option<f64>,
    pointer_y: Option<f64>,
) -> Result<bool, String> {
    require_folder(&window)?;
    if [pointer_x, pointer_y]
        .into_iter()
        .flatten()
        .any(|value| !value.is_finite() || value.abs() > 1_000_000.0)
    {
        return Err("Invalid pointer coordinates".into());
    }
    #[cfg(windows)]
    {
        use windows_sys::Win32::{
            Foundation::{HWND, POINT, RECT},
            UI::{
                Input::KeyboardAndMouse::{GetAsyncKeyState, ReleaseCapture, VK_LBUTTON},
                WindowsAndMessaging::{
                    GetCursorPos, GetWindowRect, SendMessageW, SetWindowPos, SC_MOVE,
                    SWP_NOACTIVATE, SWP_NOSIZE, SWP_NOZORDER, WM_SYSCOMMAND,
                },
            },
        };
        let handle = window.hwnd().map_err(|e| e.to_string())?.0 as usize;
        let scale = window.scale_factor().map_err(|e| e.to_string())?;
        let (send, receive) = std::sync::mpsc::sync_channel(1);
        window
            .run_on_main_thread(move || {
                // SAFETY: handle is live and belongs to this UI thread. Windows owns
                // capture during SendMessage's move loop and returns on release.
                let result = unsafe {
                    let hwnd = handle as HWND;
                    let mut before: RECT = std::mem::zeroed();
                    let mut after: RECT = std::mem::zeroed();
                    let mut cursor: POINT = std::mem::zeroed();
                    if GetWindowRect(hwnd, &mut before) == 0 || GetCursorPos(&mut cursor) == 0 {
                        Err(std::io::Error::last_os_error().to_string())
                    } else {
                        if let Some((dx, dy)) =
                            pointer_offset((cursor.x, cursor.y), (pointer_x, pointer_y), scale)
                        {
                            // Preserve movement that happened while this one IPC
                            // was in flight. A rapid released drag commits once,
                            // never starts a stale move loop and never opens.
                            if SetWindowPos(
                                hwnd,
                                std::ptr::null_mut(),
                                before.left + dx,
                                before.top + dy,
                                0,
                                0,
                                SWP_NOACTIVATE | SWP_NOZORDER | SWP_NOSIZE,
                            ) == 0
                            {
                                let _ = send.send(Err(std::io::Error::last_os_error().to_string()));
                                return;
                            }
                        }
                        if GetAsyncKeyState(VK_LBUTTON as i32) < 0 {
                            ReleaseCapture();
                            let point =
                                ((cursor.y as u16 as u32) << 16 | cursor.x as u16 as u32) as isize;
                            SendMessageW(hwnd, WM_SYSCOMMAND, (SC_MOVE | 2) as usize, point);
                        }
                        if GetWindowRect(hwnd, &mut after) == 0 {
                            Err(std::io::Error::last_os_error().to_string())
                        } else {
                            Ok(before.left != after.left || before.top != after.top)
                        }
                    }
                };
                let _ = send.send(result);
            })
            .map_err(|e| e.to_string())?;
        let moved = tauri::async_runtime::spawn_blocking(move || {
            receive.recv().map_err(|e| e.to_string())?
        })
        .await
        .map_err(|e| e.to_string())??;
        crate::desktop_windows::remember(window.app_handle(), &window);
        crate::desktop_windows::persist_later(window.app_handle());
        return Ok(moved);
    }
    #[cfg(not(windows))]
    {
        window.start_dragging().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pointer_threshold_respects_dpi_and_negative_monitors() {
        assert_eq!(
            pointer_offset((1632, 833), (Some(1108.0), Some(562.0)), 1.5),
            Some((-30, -10))
        );
        assert_eq!(
            pointer_offset((-930, 200), (Some(-640.0), Some(120.0)), 1.5),
            Some((30, 20))
        );
        assert_eq!(
            pointer_offset((1664, 844), (Some(1108.0), Some(562.0)), 1.5),
            None
        );
        assert_eq!(pointer_offset((500, 500), (None, None), 1.5), None);
    }
}
