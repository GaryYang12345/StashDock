//! User-initiated copying of the same Markdown file used by native drag.
//! No automatic paste, host IPC, focus changes, or library mutations.
use tauri::AppHandle;

#[tauri::command]
pub async fn copy_reference_file(
    app: AppHandle,
    window: tauri::WebviewWindow,
    library: tauri::State<'_, crate::library::LibraryState>,
    item_ids: Vec<String>,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Use the StashDock desktop window to copy a file.".into());
    }
    crate::reference_drag::validate_selection(&item_ids, 10_000)?;
    #[cfg(not(windows))]
    {
        let _ = (app, library);
        Err("File clipboard copying is only available on Windows.".into())
    }
    #[cfg(windows)]
    {
        let database = library.database_path().to_path_buf();
        let file = tauri::async_runtime::spawn_blocking(move || {
            crate::reference_drag::export_reference_file(
                &database,
                &item_ids,
                crate::reference_drag::ExportKind::Clipboard,
            )
        })
        .await
        .map_err(|_| "Reference file export was interrupted.".to_string())??;
        let keep = file.clone();
        let (tx, rx) = std::sync::mpsc::sync_channel(1);
        app.run_on_main_thread(move || {
            let _ = tx.send(crate::reference_drag_windows::copy_to_clipboard(
                &file.files,
            ));
        })
        .map_err(|_| "Could not start clipboard copying.".to_string())?;
        let result = tauri::async_runtime::spawn_blocking(move || rx.recv())
            .await
            .map_err(|_| "Clipboard copying was interrupted.".to_string())?
            .map_err(|_| "Clipboard copying was interrupted.".to_string())?;
        if result.is_ok() {
            tauri::async_runtime::spawn_blocking(move || {
                crate::reference_drag::prune_exports(&keep.context_file)
            });
        }
        // Retain the generated file even if flushing failed after clipboard ownership
        // changed. A receiver might already have obtained its path.
        result
    }
}
