//! Tauri adapters: disk/SQLite/image work never runs on the window thread.
//! The reservation bounds blocking workers and retained command payloads.
use super::*;
static WORK: crate::blocking_work::WorkLimit = crate::blocking_work::WorkLimit::new(4);
async fn run<T: Send + 'static>(
    app: AppHandle,
    task: impl FnOnce(&LibraryState) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    WORK.run(move || task(app.state::<LibraryState>().inner()))
        .await
}

#[tauri::command]
pub async fn initialize_library(app: AppHandle, items: Vec<StashItem>) -> Result<(), String> {
    run(app, move |s| super::initialize_library(items, s)).await
}
#[tauri::command]
pub async fn save_items(app: AppHandle, items: Vec<StashItem>) -> Result<(), String> {
    run(app, move |s| super::save_items(items, s)).await
}
#[tauri::command]
pub async fn list_items(app: AppHandle) -> Result<Vec<StashItem>, String> {
    run(app, super::list_items).await
}
#[tauri::command]
pub async fn search_items(app: AppHandle, query: String) -> Result<Vec<StashItem>, String> {
    run(app, move |s| super::search_items(query, s)).await
}
#[tauri::command]
pub async fn set_item_favorite(app: AppHandle, id: String, favorite: bool) -> Result<(), String> {
    run(app, move |s| super::set_item_favorite(id, favorite, s)).await
}
#[tauri::command]
pub async fn delete_item(app: AppHandle, id: String) -> Result<bool, String> {
    run(app, move |s| super::delete_item(id, s)).await
}
#[tauri::command]
pub async fn delete_items(app: AppHandle, ids: Vec<String>) -> Result<usize, String> {
    run(app, move |s| super::delete_items(ids, s)).await
}
#[tauri::command]
pub async fn edit_item(
    app: AppHandle,
    id: String,
    title: String,
    tags: Vec<String>,
    cover: Option<CoverEdit>,
) -> Result<Vec<StashItem>, String> {
    run(app, move |s| super::edit_item(id, title, tags, cover, s)).await
}
#[tauri::command]
pub async fn edit_item_content(
    app: AppHandle,
    id: String,
    content: String,
) -> Result<Vec<StashItem>, String> {
    run(app, move |s| super::edit_item_content(id, content, s)).await
}
#[tauri::command]
pub async fn list_pinned_tags(app: AppHandle) -> Result<Vec<String>, String> {
    run(app, super::list_pinned_tags).await
}
#[tauri::command]
pub async fn set_tag_pinned(
    app: AppHandle,
    name: String,
    pinned: bool,
) -> Result<Vec<String>, String> {
    run(app, move |s| super::set_tag_pinned(name, pinned, s)).await
}
#[tauri::command]
pub async fn change_library_tag(
    app: AppHandle,
    name: String,
    replacement: Option<String>,
) -> Result<Vec<StashItem>, String> {
    run(app, move |s| {
        super::change_library_tag(name, replacement, s)
    })
    .await
}
#[tauri::command]
pub async fn import_files(
    app: AppHandle,
    paths: Vec<String>,
    tags: Option<Vec<String>>,
) -> Result<Vec<StashItem>, String> {
    run(app, move |s| super::import_files(paths, tags, s)).await
}
#[tauri::command]
pub async fn import_file_payloads(
    app: AppHandle,
    files: Vec<file_payload::FilePayload>,
    tags: Vec<String>,
) -> Result<Vec<StashItem>, String> {
    run(app, move |s| {
        file_payload::import_file_payloads(files, tags, s)
    })
    .await
}
#[tauri::command]
pub async fn open_reference_file(app: AppHandle, id: String) -> Result<(), String> {
    let opener = app.clone();
    run(app, move |s| {
        file_payload::open_reference_file(id, opener, s)
    })
    .await
}
