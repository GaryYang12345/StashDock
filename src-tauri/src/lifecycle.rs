//! Tray actions delegate to the single desktop window lifecycle authority.
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
pub fn show_main(app: &AppHandle) {
    crate::desktop_windows::show_last(app);
}
pub fn set_tray_language(app: &AppHandle, chinese: bool) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id("stashdock") {
        let open = MenuItem::with_id(
            app,
            "open",
            if chinese {
                "打开 StashDock"
            } else {
                "Open StashDock"
            },
            true,
            None::<&str>,
        )?;
        let separator = PredefinedMenuItem::separator(app)?;
        let exit = MenuItem::with_id(
            app,
            "exit",
            if chinese {
                "退出 StashDock"
            } else {
                "Quit StashDock"
            },
            true,
            None::<&str>,
        )?;
        tray.set_menu(Some(Menu::with_items(app, &[&open, &separator, &exit])?))?;
    }
    Ok(())
}
pub fn install_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open StashDock", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let exit = MenuItem::with_id(app, "exit", "Quit StashDock", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &separator, &exit])?;
    let icon = Image::from_bytes(include_bytes!("../icons/32x32.png"))?;
    if let Some(window) = app.get_window("main") {
        window.set_icon(Image::from_bytes(include_bytes!("../icons/icon.png"))?)?;
        crate::window_frame::set_taskbar_icon(&window).map_err(std::io::Error::other)?;
    }
    TrayIconBuilder::with_id("stashdock")
        .icon(icon)
        .icon_as_template(cfg!(target_os = "macos"))
        .tooltip(if cfg!(target_os = "macos") {
            "StashDock · ⌘⇧Space"
        } else {
            "StashDock · Ctrl+Shift+Space"
        })
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "exit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}
