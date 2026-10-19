//! Static client/frame sizing. Handoffs never animate native bounds.
use tauri::WebviewWindow;

/// Hide through Tauri so Tao's visibility cache stays synchronized. DWM must
/// remove the outgoing surface immediately before the other surface is shown.
pub fn hide_immediately(window: &WebviewWindow) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::{
            Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_TRANSITIONS_FORCEDISABLED},
            UI::WindowsAndMessaging::IsWindowVisible,
        };
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as _;
        let disabled: i32 = 1;
        unsafe {
            let result = DwmSetWindowAttribute(
                hwnd,
                DWMWA_TRANSITIONS_FORCEDISABLED as u32,
                (&disabled as *const i32).cast(),
                std::mem::size_of_val(&disabled) as u32,
            );
            if result < 0 {
                eprintln!("Could not disable the native window transition: {result:#x}");
            }
        }
        window.hide().map_err(|e| e.to_string())?;
        unsafe {
            if IsWindowVisible(hwnd) != 0 {
                return Err("Could not hide the StashDock window".into());
            }
        }
        Ok(())
    }
    #[cfg(not(windows))]
    window.hide().map_err(|e| e.to_string())
}

pub fn client_frame_size(outer: (u32, u32), inner: (u32, u32), desired: (u32, u32)) -> (u32, u32) {
    (
        desired.0 + outer.0.saturating_sub(inner.0),
        desired.1 + outer.1.saturating_sub(inner.1),
    )
}

pub fn set_client_size(window: &WebviewWindow, width: u32, height: u32) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::*;
        // Tao's undecorated shadow path compensates the frame twice. Apply the
        // live native/client delta once, only when a saved size needs restoring.
        let outer = window.outer_size().map_err(|e| e.to_string())?;
        let inner = window.inner_size().map_err(|e| e.to_string())?;
        let (width, height) = client_frame_size(
            (outer.width, outer.height),
            (inner.width, inner.height),
            (width, height),
        );
        let handle = window.hwnd().map_err(|e| e.to_string())?.0 as _;
        if unsafe {
            SetWindowPos(
                handle,
                std::ptr::null_mut(),
                0,
                0,
                width as i32,
                height as i32,
                SWP_NOMOVE | SWP_NOACTIVATE | SWP_NOZORDER | SWP_NOOWNERZORDER,
            )
        } == 0
        {
            return Err("Could not restore the StashDock window size.".into());
        }
        Ok(())
    }
    #[cfg(not(windows))]
    window
        .set_size(tauri::PhysicalSize::new(width, height))
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn frame_compensation_does_not_accumulate() {
        let mut outer = (1135, 769);
        for _ in 0..20 {
            outer = client_frame_size(outer, (outer.0 - 15, outer.1 - 9), (1120, 760));
            assert_eq!(outer, (1135, 769));
        }
    }
}
