//! Static client/frame sizing. Handoffs never animate native bounds.
use tauri::WebviewWindow;

/// Apply the same policy before SHOW as before HIDE. Setting this only when
/// hiding leaves the folder's first reveal subject to the OS entrance fade.
fn disable_transitions(window: &WebviewWindow) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::Graphics::Dwm::{
            DwmSetWindowAttribute, DWMWA_TRANSITIONS_FORCEDISABLED,
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
    }
    let _ = window;
    Ok(())
}

pub fn show_immediately(window: &WebviewWindow) -> Result<(), String> {
    disable_transitions(window)?;
    window.show().map_err(|e| e.to_string())
}

pub fn minimize_immediately(window: &WebviewWindow) -> Result<(), String> {
    disable_transitions(window)?;
    window.minimize().map_err(|e| e.to_string())
}

/// A minimized panel must be restored before measuring/repositioning its real
/// client frame. Keep that preparation out of sight, without changing Tauri's
/// visibility cache or using a transparent/layered dashboard window.
pub struct PreparedRestore {
    window: WebviewWindow,
    cloaked: bool,
}
impl PreparedRestore {
    pub fn new(window: &WebviewWindow) -> Result<Self, String> {
        let mut restore = Self {
            window: window.clone(),
            cloaked: false,
        };
        if window.is_minimized().map_err(|e| e.to_string())? {
            disable_transitions(window)?;
            #[cfg(windows)]
            {
                set_cloaked(window, true)?;
                restore.cloaked = true;
            }
            window.unminimize().map_err(|e| e.to_string())?;
        }
        Ok(restore)
    }
    pub fn reveal(&mut self) -> Result<(), String> {
        if self.cloaked {
            set_cloaked(&self.window, false)?;
            self.cloaked = false;
        }
        Ok(())
    }
}
impl Drop for PreparedRestore {
    fn drop(&mut self) {
        if self.cloaked {
            // Failure before reveal must not expose the partially prepared
            // destination or leave a permanently cloaked window behind.
            let _ = self.window.hide();
            if let Err(error) = set_cloaked(&self.window, false) {
                eprintln!("Could not reset the panel's preparation state: {error}");
            }
        }
    }
}
fn set_cloaked(window: &WebviewWindow, cloaked: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_CLOAK};
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as _;
        let value = i32::from(cloaked);
        let result = unsafe {
            DwmSetWindowAttribute(
                hwnd,
                DWMWA_CLOAK as u32,
                (&value as *const i32).cast(),
                std::mem::size_of_val(&value) as u32,
            )
        };
        if result < 0 {
            return Err(format!("Could not prepare the panel: {result:#x}"));
        }
    }
    let _ = (window, cloaked);
    Ok(())
}

/// Tauri/Tao's set_icon updates ICON_SMALL only. Publish the same high-resolution
/// image as ICON_BIG instead of letting Shell fall back to a class/default icon.
/// Tao owns this handle for the window's lifetime; never destroy this borrowed
/// handle or introduce a second icon cache/owner.
pub fn set_taskbar_icon(window: &WebviewWindow) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SendMessageW, ICON_BIG, ICON_SMALL, WM_GETICON, WM_SETICON,
        };
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as _;
        let icon = unsafe { SendMessageW(hwnd, WM_GETICON, ICON_SMALL as usize, 0) };
        if icon == 0 {
            return Err("The StashDock window icon is unavailable".into());
        }
        unsafe {
            SendMessageW(hwnd, WM_SETICON, ICON_BIG as usize, icon);
        }
    }
    let _ = window;
    Ok(())
}

/// Framework visibility remains authoritative, including on repeated switches.
pub fn hide_immediately(window: &WebviewWindow) -> Result<(), String> {
    disable_transitions(window)?;
    window.hide().map_err(|e| e.to_string())?;
    #[cfg(windows)]
    unsafe {
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as _;
        if windows_sys::Win32::UI::WindowsAndMessaging::IsWindowVisible(hwnd) != 0 {
            return Err("Could not hide the StashDock window".into());
        }
    }
    Ok(())
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
