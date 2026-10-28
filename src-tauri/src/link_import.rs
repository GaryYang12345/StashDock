//! Desktop-only browser adapters. No cookies, history queries or bookmark writes.
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    fs,
    io::Read,
    path::{Path, PathBuf},
    time::Duration,
};
use url::Url;

const MAX_BOOKMARKS: usize = 50_000;
const MAX_BOOKMARK_BYTES: u64 = 32 * 1024 * 1024;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserSource {
    id: String,
    browser: String,
    profile: String,
}
struct SourceFile {
    source: BrowserSource,
    paths: Vec<PathBuf>,
    firefox: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserBookmark {
    title: String,
    url: String,
    folder_path: Vec<String>,
    saved_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    favicon_url: Option<String>,
}

#[cfg(test)]
fn browser_sources(platform: &str, env: impl Fn(&str) -> Option<PathBuf>) -> Vec<SourceFile> {
    browser_sources_with_errors(platform, env, None, |_, _| {})
}

fn browser_sources_with_errors(
    platform: &str,
    env: impl Fn(&str) -> Option<PathBuf>,
    only_browser: Option<&str>,
    mut on_error: impl FnMut(&str, std::io::Error),
) -> Vec<SourceFile> {
    let layouts: Value =
        serde_json::from_str(include_str!("../../shared/browser-profile-layouts.json"))
            .expect("valid browser profile layouts");
    let mut sources = Vec::new();
    let Some(entries) = layouts[platform].as_array() else {
        return sources;
    };
    for entry in entries {
        let Some(base) = env(entry["base"].as_str().unwrap()) else {
            continue;
        };
        let browser = entry["browser"].as_str().unwrap();
        if only_browser.is_some_and(|name| name != browser) {
            continue;
        }
        let root = base.join(entry["path"].as_str().unwrap());
        let firefox = entry["id"] == "firefox";
        let files = entry["files"]
            .as_array()
            .expect("known browser bookmark files");
        let root_absolute = match root.canonicalize() {
            Ok(path) => path,
            Err(error) => {
                on_error(browser, error);
                continue;
            }
        };
        if browser == "Safari" {
            let path = root.join("Bookmarks.plist");
            match path.canonicalize() {
                Ok(path) if path.starts_with(&root_absolute) && path.is_file() => {
                    sources.push(SourceFile {
                        source: BrowserSource {
                            id: "safari:Default".into(),
                            browser: "Safari".into(),
                            profile: "Default".into(),
                        },
                        paths: vec![path],
                        firefox: false,
                    })
                }
                Ok(_) => {}
                Err(error) => on_error(browser, error),
            }
            continue;
        }
        let entries = match fs::read_dir(&root) {
            Ok(entries) => entries,
            Err(error) => {
                on_error(browser, error);
                continue;
            }
        };
        let names: Value = fs::read(root.join("Local State"))
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or(Value::Null);
        for entry in entries.flatten() {
            let folder = entry.file_name().to_string_lossy().into_owned();
            if !firefox
                && folder != "Default"
                && !folder.starts_with("Profile ")
                && names["profile"]["info_cache"].get(&folder).is_none()
            {
                continue;
            }
            let mut paths = Vec::new();
            for file in files.iter().filter_map(Value::as_str) {
                match entry.path().join(file).canonicalize() {
                    Ok(path) if path.starts_with(&root_absolute) && path.is_file() => {
                        paths.push(path)
                    }
                    Ok(_) => {} // A redirected bookmark file is outside the selected browser root.
                    Err(error) if error.kind() != std::io::ErrorKind::NotFound => {
                        on_error(browser, error)
                    }
                    Err(_) => {} // Either local or account storage may legitimately be absent.
                }
            }
            if paths.is_empty() {
                continue;
            }
            let profile = if firefox {
                folder
                    .split_once('.')
                    .map(|(_, name)| name)
                    .unwrap_or(&folder)
                    .to_string()
            } else {
                names["profile"]["info_cache"][&folder]["name"]
                    .as_str()
                    .unwrap_or(&folder)
                    .to_string()
            };
            sources.push(SourceFile {
                source: BrowserSource {
                    id: format!("{}:{folder}", browser.to_lowercase()),
                    browser: browser.into(),
                    profile,
                },
                paths,
                firefox,
            });
        }
    }
    sources.sort_by(|a, b| a.source.id.cmp(&b.source.id));
    sources
}

fn discovered_sources() -> Result<Vec<SourceFile>, String> {
    let platform = if cfg!(windows) {
        "win32"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        return Err("Browser import is not available on this platform.".into());
    };
    let mut denied = false;
    let sources = browser_sources_with_errors(
        platform,
        |name| std::env::var_os(name).map(PathBuf::from),
        None,
        |_, error| {
            denied |= error.kind() == std::io::ErrorKind::PermissionDenied
                || (cfg!(unix) && error.raw_os_error() == Some(1));
        },
    );
    if sources.is_empty() && denied {
        return Err("Browser data access was denied. Choose a bookmark file to continue.".into());
    }
    Ok(sources)
}

fn date_from_micros(value: i128) -> Option<String> {
    time::OffsetDateTime::from_unix_timestamp_nanos(value.checked_mul(1000)?)
        .ok()?
        .format(&time::format_description::well_known::Rfc3339)
        .ok()
}
fn bookmark(
    title: &str,
    raw: &str,
    folders: &[String],
    saved_at: Option<String>,
) -> Option<BrowserBookmark> {
    let url = Url::parse(raw).ok()?;
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return None;
    }
    Some(BrowserBookmark {
        title: if title.trim().is_empty() {
            url.host_str()?.into()
        } else {
            title.trim().chars().take(500).collect()
        },
        url: url.into(),
        folder_path: folders.to_vec(),
        saved_at,
        favicon_url: None,
    })
}
fn walk_chromium(
    node: &Value,
    folders: &mut Vec<String>,
    items: &mut Vec<BrowserBookmark>,
    depth: usize,
) {
    if depth > 64 || items.len() >= MAX_BOOKMARKS {
        return;
    }
    if node["type"] == "url" {
        let date = node["date_added"]
            .as_str()
            .and_then(|v| v.parse::<i128>().ok())
            .and_then(|v| date_from_micros(v - 11_644_473_600_000_000));
        if let Some(item) = bookmark(
            node["name"].as_str().unwrap_or(""),
            node["url"].as_str().unwrap_or(""),
            folders,
            date,
        ) {
            items.push(item);
        }
    } else if let Some(children) = node["children"].as_array() {
        let name = node["name"].as_str().unwrap_or("").trim();
        let has_name = !name.is_empty();
        if has_name {
            folders.push(name.to_string());
        }
        for child in children {
            walk_chromium(child, folders, items, depth + 1);
        }
        if has_name {
            folders.pop();
        }
    }
}
fn chromium_bookmarks(path: &Path) -> Result<Vec<BrowserBookmark>, String> {
    let file =
        fs::File::open(path).map_err(|_| "Bookmarks could not be opened. Retry the import.")?;
    let mut bytes = Vec::new();
    file.take(MAX_BOOKMARK_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Bookmarks could not be read.")?;
    if bytes.len() as u64 > MAX_BOOKMARK_BYTES {
        return Err("This bookmark collection is too large to read in one import.".into());
    }
    let root: Value = serde_json::from_slice(&bytes)
        .map_err(|_| "Bookmarks are being updated. Retry in a moment.")?;
    let roots = root["roots"]
        .as_object()
        .ok_or("This browser's bookmark format is not supported.")?;
    let mut items = Vec::new();
    for node in roots.values() {
        walk_chromium(node, &mut Vec::new(), &mut items, 0);
    }
    if items.len() >= MAX_BOOKMARKS {
        return Err(
            "This profile has too many bookmarks for one import. Use a smaller browser profile."
                .into(),
        );
    }
    Ok(items)
}
fn firefox_read_error(error: rusqlite::Error) -> String {
    match error.sqlite_error_code() {
        Some(rusqlite::ErrorCode::DatabaseBusy | rusqlite::ErrorCode::DatabaseLocked) =>
            "Firefox is using its bookmarks. Quit Firefox, then click Refresh bookmarks.".into(),
        _ => "Firefox bookmarks could not be read. Try again after quitting Firefox, or import an exported bookmark HTML file.".into(),
    }
}

fn firefox_bookmarks(path: &Path) -> Result<Vec<BrowserBookmark>, String> {
    let connection = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(firefox_read_error)?;
    connection
        .busy_timeout(Duration::from_millis(1000))
        .map_err(firefox_read_error)?;
    // One read transaction keeps folder names and bookmarks in the same snapshot.
    connection
        .execute_batch("BEGIN")
        .map_err(firefox_read_error)?;
    let mut folders = HashMap::new();
    let mut statement = connection
        .prepare("SELECT id, parent, COALESCE(title, ''), guid FROM moz_bookmarks WHERE type = 2 LIMIT 50001")
        .map_err(firefox_read_error)?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(firefox_read_error)?;
    for row in rows {
        let (id, parent, title, guid) = row.map_err(firefox_read_error)?;
        folders.insert(id, (parent, title, guid));
        if folders.len() > MAX_BOOKMARKS {
            return Err("This bookmark collection is too large to import.".into());
        }
    }
    let mut statement = connection.prepare("SELECT COALESCE(b.title, p.title, ''), p.url, b.parent, b.dateAdded FROM moz_bookmarks b JOIN moz_places p ON p.id = b.fk WHERE b.type = 1 ORDER BY b.id LIMIT 50001").map_err(firefox_read_error)?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })
        .map_err(firefox_read_error)?;
    let mut items = Vec::new();
    for row in rows {
        let (title, url, mut parent, date) = row.map_err(firefox_read_error)?;
        let mut path = Vec::new();
        let mut seen = HashSet::new();
        let mut is_tag = false;
        while let Some((next, name, guid)) = folders.get(&parent) {
            if !seen.insert(parent) || seen.len() > 64 {
                break;
            }
            if guid == "tags________" {
                is_tag = true;
                break;
            }
            if !name.is_empty() {
                path.push(name.clone());
            }
            parent = *next;
        }
        if is_tag {
            continue;
        }
        path.reverse();
        if let Some(item) = bookmark(&title, &url, &path, date_from_micros(date.into())) {
            items.push(item);
        }
    }
    if items.len() > MAX_BOOKMARKS {
        return Err(
            "This profile has too many bookmarks for one import. Use a smaller browser profile."
                .into(),
        );
    }
    Ok(items)
}

fn cached_bookmark_icons(bookmarks_path: &Path, items: &mut [BrowserBookmark]) {
    let Some(parent) = bookmarks_path.parent() else {
        return;
    };
    let path = parent.join("Favicons");
    // Never copy a live SQLite database without its WAL, never force-close a browser.
    let Ok(path) = path.canonicalize() else {
        return;
    };
    let Ok(root) = parent.canonicalize() else {
        return;
    };
    if !path.starts_with(root) {
        return;
    }
    let Ok(db) = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    ) else {
        return;
    };
    let _ = db.busy_timeout(Duration::from_millis(100));
    if db.execute_batch("BEGIN").is_err() {
        return;
    }
    let Ok(mut query) = db.prepare("SELECT b.image_data FROM icon_mapping m JOIN favicon_bitmaps b ON b.icon_id = m.icon_id WHERE m.page_url = ?1 AND length(b.image_data) BETWEEN 8 AND 131072 ORDER BY ABS(b.width - 32) LIMIT 1") else { return; };
    let mut bytes = 0;
    for item in items.iter_mut().take(2000) {
        let data = query.query_row([&item.url], |row| row.get::<_, Vec<u8>>(0));
        match data {
            Ok(data) => {
                if let Ok(icon) = crate::web_images::raster(&data, true) {
                    bytes += icon.len();
                    if bytes > 4 * 1024 * 1024 {
                        break;
                    }
                    item.favicon_url = Some(icon);
                }
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => {}
            Err(_) => break, // Locked or incompatible cache: use public web fallback instead.
        }
    }
}

#[tauri::command]
pub async fn list_browser_sources() -> Result<Vec<BrowserSource>, String> {
    // On Mac, obtain user-selected access before touching another app's data.
    // The independent helper retains its snapshot API for explicit callers.
    if cfg!(target_os = "macos") {
        return Ok(Vec::new());
    }
    tauri::async_runtime::spawn_blocking(browser_sources_snapshot)
        .await
        .map_err(|_| "Browser profiles could not be located.")?
}
#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum BrowserImportState {
    Ready {
        bookmarks: Vec<BrowserBookmark>,
    },
    NeedsAccess {
        #[serde(skip_serializing_if = "Option::is_none")]
        folder: Option<String>,
    },
    Unavailable,
}

fn browser_access_prompt(platform: &str, browser: &str) -> BrowserImportState {
    let layouts: Value =
        serde_json::from_str(include_str!("../../shared/browser-profile-layouts.json"))
            .expect("valid browser layouts");
    let folder = if platform == "darwin" {
        layouts[platform]
            .as_array()
            .and_then(|entries| {
                entries
                    .iter()
                    .find(|entry| entry["browser"].as_str() == Some(browser))
            })
            .and_then(|entry| entry["path"].as_str())
            .map(|path| format!("~/{path}"))
    } else {
        None
    };
    BrowserImportState::NeedsAccess { folder }
}

fn access_denied(error: &std::io::Error) -> bool {
    error.kind() == std::io::ErrorKind::PermissionDenied
        || (cfg!(unix) && error.raw_os_error() == Some(1))
}

fn probe_browser_import(
    platform: &str,
    browser: &str,
    env: impl Fn(&str) -> Option<PathBuf>,
) -> Result<BrowserImportState, String> {
    let mut denied = false;
    let sources = browser_sources_with_errors(platform, env, Some(browser), |_, error| {
        denied |= access_denied(&error)
    });
    // Never present a partial collection as a complete import.
    if denied {
        return Ok(browser_access_prompt(platform, browser));
    }
    if sources.is_empty() {
        return Ok(BrowserImportState::Unavailable);
    }
    let mut bookmarks = Vec::new();
    for source in sources {
        for path in &source.paths {
            if let Err(error) = fs::File::open(path) {
                if access_denied(&error) {
                    return Ok(browser_access_prompt(platform, browser));
                }
                return Err("Bookmarks could not be read. Retry the import.".into());
            }
        }
        let next = source_bookmarks(&source)?;
        if bookmarks.len() + next.len() > MAX_BOOKMARKS {
            return Err("This bookmark collection is too large to read in one import.".into());
        }
        bookmarks.extend(next);
    }
    Ok(BrowserImportState::Ready { bookmarks })
}

/// Reading is user-initiated. Only the OS picker can grant missing access.
#[tauri::command]
pub async fn read_browser_import(
    browser: String,
    request_access: bool,
) -> Result<BrowserImportState, String> {
    tauri::async_runtime::spawn_blocking(move || {
        read_browser_import_snapshot(&browser, request_access)
    })
    .await
    .map_err(|_| "Bookmarks could not be read. Retry the import.".to_string())?
}

// One platform reader and consent flow for Desktop and the packaged MCP helper.
// Desktop calls from a blocking worker; the standalone helper owns its main thread.
pub fn read_browser_import_snapshot(
    browser: &str,
    request_access: bool,
) -> Result<BrowserImportState, String> {
    if !["Chrome", "Edge", "Firefox", "Safari"].contains(&browser) {
        return Err("Choose a supported browser.".into());
    }
    let state = probe_browser_import(
        if cfg!(target_os = "macos") {
            "darwin"
        } else {
            "win32"
        },
        browser,
        |name| std::env::var_os(name).map(PathBuf::from),
    )?;
    if !request_access || !matches!(state, BrowserImportState::NeedsAccess { .. }) {
        return Ok(state);
    }
    #[cfg(target_os = "macos")]
    {
        let layouts: Value =
            serde_json::from_str(include_str!("../../shared/browser-profile-layouts.json"))
                .expect("valid browser layouts");
        let layout = layouts["darwin"]
            .as_array()
            .unwrap()
            .iter()
            .find(|layout| layout["browser"].as_str() == Some(browser))
            .ok_or("Choose a supported browser.")?;
        let home = std::env::var_os("HOME")
            .map(PathBuf::from)
            .ok_or("Home folder is unavailable.")?;
        let root = home.join(layout["path"].as_str().unwrap());
        let Some(selected) = rfd::FileDialog::new()
            .set_title(format!("StashDock: {browser}"))
            .set_directory(&root)
            .pick_folder()
        else {
            return Ok(state);
        };
        let expected = root
            .canonicalize()
            .map_err(|_| "The selected browser folder could not be read.")?;
        let chosen = selected
            .canonicalize()
            .map_err(|_| "The selected browser folder could not be read.")?;
        if chosen != expected {
            return Err("Select the browser data folder shown when the picker opens.".into());
        }
        probe_browser_import("darwin", browser, |_| Some(home.clone()))
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(state)
    }
}

#[tauri::command]
pub async fn read_browser_bookmarks(source_id: String) -> Result<Vec<BrowserBookmark>, String> {
    tauri::async_runtime::spawn_blocking(move || browser_bookmarks_snapshot(&source_id))
        .await
        .map_err(|_| "Bookmarks could not be read. Retry the import.")?
}

// Both the Tauri command and independent MCP helper use this exact reader.
pub fn browser_sources_snapshot() -> Result<Vec<BrowserSource>, String> {
    if cfg!(target_os = "macos") {
        return Ok(Vec::new());
    }
    discovered_sources().map(|sources| sources.into_iter().map(|file| file.source).collect())
}
pub fn browser_bookmarks_snapshot(source_id: &str) -> Result<Vec<BrowserBookmark>, String> {
    // The caller provides a discovered opaque id, never a file path.
    let source = discovered_sources()?
        .into_iter()
        .find(|file| file.source.id == source_id)
        .ok_or("This browser profile is no longer available. Reopen Import references.")?;
    let mut items = source_bookmarks(&source)?;
    if !source.firefox && source.source.browser != "Safari" {
        cached_bookmark_icons(&source.paths[0], &mut items);
    }
    Ok(items)
}

fn safari_bookmarks(path: &Path) -> Result<Vec<BrowserBookmark>, String> {
    let file =
        fs::File::open(path).map_err(|_| "Bookmarks could not be opened. Retry the import.")?;
    let mut bytes = Vec::new();
    file.take(MAX_BOOKMARK_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Bookmarks could not be read.")?;
    if bytes.len() as u64 > MAX_BOOKMARK_BYTES {
        return Err("This bookmark collection is too large to read in one import.".into());
    }
    let root = plist::Value::from_reader(std::io::Cursor::new(bytes))
        .map_err(|_| "Bookmarks are being updated. Retry in a moment.")?;
    fn walk(
        node: &plist::Value,
        folders: &[String],
        rows: &mut Vec<BrowserBookmark>,
        depth: usize,
    ) -> Result<(), String> {
        if depth > 64 {
            return Err("This bookmark collection is too large to read in one import.".into());
        }
        let Some(node) = node.as_dictionary() else {
            return Ok(());
        };
        let text = |key: &str| {
            node.get(key)
                .and_then(plist::Value::as_string)
                .unwrap_or("")
        };
        // Reading List and dynamic proxies are separate Safari features.
        if text("Title") == "com.apple.ReadingList" {
            return Ok(());
        }
        if text("WebBookmarkType") == "WebBookmarkTypeLeaf" {
            let title = node
                .get("URIDictionary")
                .and_then(plist::Value::as_dictionary)
                .and_then(|dict| dict.get("title"))
                .and_then(plist::Value::as_string)
                .unwrap_or("");
            if let Some(row) = bookmark(title, text("URLString"), folders, None) {
                rows.push(row);
            }
            if rows.len() > MAX_BOOKMARKS {
                return Err("This bookmark collection is too large to read in one import.".into());
            }
        } else if let Some(children) = node.get("Children").and_then(plist::Value::as_array) {
            let mut path = folders.to_vec();
            if !text("Title").is_empty() {
                path.push(text("Title").to_owned());
            }
            for child in children {
                walk(child, &path, rows, depth + 1)?;
            }
        }
        Ok(())
    }
    let mut rows = Vec::new();
    walk(&root, &[], &mut rows, 0)?;
    Ok(rows)
}

fn source_bookmarks(source: &SourceFile) -> Result<Vec<BrowserBookmark>, String> {
    if source.source.browser == "Safari" {
        return safari_bookmarks(&source.paths[0]);
    }
    if source.firefox {
        return firefox_bookmarks(&source.paths[0]);
    }
    let mut rows = Vec::new();
    for path in &source.paths {
        let next = chromium_bookmarks(path)?;
        if rows.len() + next.len() > MAX_BOOKMARKS {
            return Err("This bookmark collection is too large to read in one import.".into());
        }
        rows.extend(next);
    }
    Ok(rows)
}

#[tauri::command]
pub async fn read_browser_bookmark_icons(
    urls: Vec<String>,
) -> Result<HashMap<String, String>, String> {
    tauri::async_runtime::spawn_blocking(move || bookmark_icons(&urls))
        .await
        .map_err(|_| "Bookmark icons could not be read.")?
}
pub fn bookmark_icons(urls: &[String]) -> Result<HashMap<String, String>, String> {
    if urls.len() > 12 {
        return Err("Read at most 12 bookmark icons at a time.".into());
    }
    let deadline = std::time::Instant::now() + Duration::from_secs(24);
    let results = std::sync::Mutex::new(HashMap::new());
    let index = std::sync::atomic::AtomicUsize::new(0);
    std::thread::scope(|scope| {
        for _ in 0..4 {
            scope.spawn(|| loop {
                let next = index.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                let Some(raw) = urls.get(next) else {
                    break;
                };
                if std::time::Instant::now() >= deadline {
                    break;
                }
                let Ok(url) = crate::public_web::web_url(raw) else {
                    continue;
                };
                let item_deadline =
                    deadline.min(std::time::Instant::now() + Duration::from_secs(6));
                let mut candidates = Vec::new();
                // Use the public origin, never a bookmark's query/fragment. No
                // browser opens and no scripts run. Custom rel=icon precedes paths.
                let homepage = format!("{}/", url.origin().ascii_serialization());
                if let Ok(page) = crate::public_web::fetch(
                    &homepage,
                    512_000,
                    "text/html,application/xhtml+xml",
                    item_deadline.min(std::time::Instant::now() + Duration::from_secs(2)),
                ) {
                    if page.content_type.contains("html") {
                        if let Some(icon) = crate::link_metadata::extract_preview(
                            &String::from_utf8_lossy(&page.bytes),
                            &page.url,
                        )
                        .favicon_url
                        {
                            candidates.push(icon);
                        }
                    }
                }
                candidates.extend(
                    [
                        "/favicon.ico",
                        "/favicon.svg",
                        "/favicon.png",
                        "/apple-touch-icon.png",
                    ]
                    .into_iter()
                    .filter_map(|path| url.join(path).ok().map(String::from)),
                );
                for candidate in candidates.into_iter().take(5) {
                    if let Ok(icon) = crate::web_images::download(&candidate, true, item_deadline) {
                        results.lock().unwrap().insert(raw.clone(), icon);
                        break;
                    }
                }
            });
        }
    });
    Ok(results.into_inner().unwrap())
}

#[cfg(test)]
use crate::link_metadata::extract_preview;
#[cfg(test)]
use crate::link_metadata::fetch_preview;
#[cfg(test)]
fn public_ip(ip: std::net::IpAddr) -> bool {
    crate::public_web::public_ip(ip)
}
#[cfg(test)]
fn web_url(value: &str) -> Result<Url, String> {
    crate::public_web::web_url(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bookmark_icon_batches_are_bounded_and_reject_private_targets() {
        assert!(bookmark_icons(&vec!["https://example.org/".into(); 13]).is_err());
        assert!(bookmark_icons(&[
            "http://127.0.0.1/".into(),
            "file:///secret".into(),
            "https://user:pass@example.org/".into()
        ])
        .unwrap()
        .is_empty());
    }
    #[test]
    fn browser_cache_webp_icons_share_bounded_png_conversion() {
        let root = temp_root();
        let path = root.join("Favicons");
        let db = Connection::open(&path).unwrap();
        db.execute_batch("CREATE TABLE icon_mapping(page_url TEXT,icon_id INTEGER); CREATE TABLE favicon_bitmaps(icon_id INTEGER,image_data BLOB,width INTEGER); INSERT INTO icon_mapping VALUES('https://example.org/',1);").unwrap();
        let mut webp = Vec::new();
        image::DynamicImage::new_rgba8(128, 128)
            .write_to(
                &mut std::io::Cursor::new(&mut webp),
                image::ImageFormat::WebP,
            )
            .unwrap();
        db.execute("INSERT INTO favicon_bitmaps VALUES(1,?1,128)", [&webp])
            .unwrap();
        drop(db);
        let before = fs::read(&path).unwrap();
        let mut items = vec![bookmark("Page", "https://example.org/", &[], None).unwrap()];
        cached_bookmark_icons(&root.join("Bookmarks"), &mut items);
        let icon = items[0].favicon_url.as_ref().unwrap();
        assert!(icon.starts_with("data:image/png;base64,"));
        assert!(icon.len() <= 32768);
        assert_eq!(before, fs::read(&path).unwrap());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn public_lookup_live_smoke_when_requested() {
        if std::env::var("STASHDOCK_LINK_SMOKE").as_deref() != Ok("1") {
            return;
        }
        let result = fetch_preview("https://example.org").expect("public lookup");
        assert!(result.title.contains("Example Domain"));
        eprintln!("Public page lookup returned a real title. No collection writes.");
        let sources = discovered_sources().expect("local profile discovery");
        eprintln!(
            "Discovered {} browser profiles (paths and contents omitted).",
            sources.len()
        );
        for source in sources {
            let rows = source_bookmarks(&source).expect("read-only local bookmark adapter");
            eprintln!(
                "{} adapter read {} web bookmarks; titles and URLs omitted.",
                source.source.browser,
                rows.len()
            );
        }
    }
    fn temp_root() -> PathBuf {
        let path = std::env::temp_dir().join(format!("stashdock-import-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        path
    }
    #[test]
    fn chromium_preserves_folders_dates_and_rejects_non_web_links() {
        let root = temp_root();
        let file = root.join("Bookmarks");
        fs::write(&file, r#"{"roots":{"bookmark_bar":{"type":"folder","name":"Bookmarks bar","children":[{"type":"folder","name":"Research","children":[{"type":"url","name":"A & B","url":"https://example.org","date_added":"13348540800000000"},{"type":"url","url":"javascript:alert(1)"}]}]}}}"#).unwrap();
        let bytes = fs::read(&file).unwrap();
        let items = chromium_bookmarks(&file).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].folder_path, ["Bookmarks bar", "Research"]);
        assert_eq!(items[0].title, "A & B");
        assert!(items[0].saved_at.is_some());
        assert_eq!(bytes, fs::read(&file).unwrap());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn chromium_discovers_local_account_and_account_only_profiles_without_writes() {
        let root = temp_root();
        for browser in ["Google/Chrome", "Microsoft/Edge"] {
            let browser_root = root.join(browser).join("User Data");
            fs::create_dir_all(browser_root.join("Default")).unwrap();
            fs::create_dir_all(browser_root.join("Registered work")).unwrap();
            fs::write(
                browser_root.join("Local State"),
                r#"{"profile":{"info_cache":{"Registered work":{"name":"Work"}}}}"#,
            )
            .unwrap();
            let local = r#"{"roots":{"bookmark_bar":{"type":"folder","name":"Toolbar","children":[{"type":"url","name":"Local","url":"https://example.org/local"}]}}}"#;
            let account = r#"{"roots":{"other":{"type":"folder","name":"Account","children":[{"type":"url","name":"Cloud","url":"https://example.org/cloud"}]},"synced":{"type":"folder","name":"Mobile","children":[{"type":"url","name":"Phone","url":"https://example.org/phone"}]}}}"#;
            fs::write(browser_root.join("Default/Bookmarks"), local).unwrap();
            fs::write(browser_root.join("Default/AccountBookmarks"), account).unwrap();
            fs::write(
                browser_root.join("Registered work/AccountBookmarks"),
                account,
            )
            .unwrap();
            // Retired backups are not additional live bookmark stores.
            fs::write(browser_root.join("Default/Bookmarks.bak"), account).unwrap();
            let sources = browser_sources("win32", |_| Some(root.clone()));
            let prefix = if browser.contains("Chrome") {
                "chrome"
            } else {
                "edge"
            };
            let source = sources
                .iter()
                .find(|s| s.source.id == format!("{prefix}:Default"))
                .unwrap();
            assert_eq!(source.paths.len(), 2);
            let items = source_bookmarks(source).unwrap();
            assert_eq!(items.len(), 3);
            assert_eq!(items[0].title, "Local");
            assert!(items.iter().any(|item| item.folder_path == ["Mobile"]));
            let account_only = sources
                .iter()
                .find(|s| s.source.id == format!("{prefix}:Registered work"))
                .unwrap();
            assert_eq!(account_only.source.profile, "Work");
            assert_eq!(source_bookmarks(account_only).unwrap().len(), 2);
            assert_eq!(
                fs::read_to_string(browser_root.join("Default/AccountBookmarks")).unwrap(),
                account
            );
        }
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn discovery_only_reads_supported_profile_files() {
        let root = temp_root();
        let profile = root.join("Google/Chrome/User Data/Default");
        fs::create_dir_all(&profile).unwrap();
        fs::write(profile.join("Bookmarks"), "{}").unwrap();
        let sources = browser_sources("win32", |_| Some(root.clone()));
        assert_eq!(sources.len(), 1);
        assert_eq!(sources[0].source.id, "chrome:Default");
        assert!(!sources[0].firefox);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn mac_profiles_use_application_support_and_keep_bookmarks_read_only() {
        let home = temp_root();
        let paths = [
            "Library/Application Support/Google/Chrome/Default/Bookmarks",
            "Library/Application Support/Microsoft Edge/Profile 1/Bookmarks",
            "Library/Application Support/Firefox/Profiles/fixture.default/places.sqlite",
        ];
        let body = r#"{"roots":{"bar":{"type":"folder","name":"Research","children":[{"type":"url","name":"Mac fixture","url":"https://example.org/mac"}]}}}"#;
        for path in paths {
            let path = home.join(path);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, body).unwrap();
        }
        let sources = browser_sources("darwin", |name| (name == "HOME").then(|| home.clone()));
        assert_eq!(
            sources
                .iter()
                .map(|source| source.source.id.as_str())
                .collect::<Vec<_>>(),
            [
                "chrome:Default",
                "edge:Profile 1",
                "firefox:fixture.default"
            ]
        );
        for source in sources.iter().filter(|source| !source.firefox) {
            let before = fs::read(&source.paths[0]).unwrap();
            let rows = chromium_bookmarks(&source.paths[0]).unwrap();
            assert_eq!(rows.len(), 1);
            assert_eq!(rows[0].folder_path, ["Research"]);
            assert_eq!(before, fs::read(&source.paths[0]).unwrap());
        }
        assert!(browser_sources("win32", |name| (name == "HOME").then(|| home.clone())).is_empty());
        fs::remove_dir_all(home).unwrap();
    }
    #[test]
    fn unified_import_distinguishes_missing_empty_and_ready_without_writes() {
        let home = temp_root();
        assert!(matches!(
            probe_browser_import("darwin", "Firefox", |_| Some(home.clone())).unwrap(),
            BrowserImportState::Unavailable
        ));
        let profile = home.join("Library/Application Support/Google/Chrome/Default");
        fs::create_dir_all(&profile).unwrap();
        fs::write(profile.join("Bookmarks"), r#"{"roots":{}}"#).unwrap();
        assert!(
            matches!(probe_browser_import("darwin", "Chrome", |_| Some(home.clone())).unwrap(), BrowserImportState::Ready { bookmarks } if bookmarks.is_empty())
        );
        fs::remove_dir_all(home).unwrap();
    }
    #[cfg(target_os = "macos")]
    #[test]
    fn unified_import_requests_access_for_a_real_unreadable_browser_directory() {
        use std::os::unix::fs::PermissionsExt;
        let home = temp_root();
        let root = home.join("Library/Application Support/Google/Chrome");
        fs::create_dir_all(&root).unwrap();
        fs::set_permissions(&root, fs::Permissions::from_mode(0o000)).unwrap();
        let result = probe_browser_import("darwin", "Chrome", |_| Some(home.clone()));
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).unwrap();
        fs::remove_dir_all(home).unwrap();
        assert!(
            matches!(result.unwrap(), BrowserImportState::NeedsAccess { folder: Some(folder) } if folder == "~/Library/Application Support/Google/Chrome")
        );
    }
    #[test]
    fn safari_xml_and_binary_bookmarks_are_read_only_and_exclude_non_web_entries() {
        let home = temp_root();
        let root = home.join("Library/Safari");
        fs::create_dir_all(&root).unwrap();
        let xml = br#"<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Children</key><array><dict><key>Title</key><string>Research</string><key>Children</key><array><dict><key>WebBookmarkType</key><string>WebBookmarkTypeLeaf</string><key>URLString</key><string>https://example.org/safari</string><key>URIDictionary</key><dict><key>title</key><string>Safari fixture</string></dict></dict><dict><key>WebBookmarkType</key><string>WebBookmarkTypeLeaf</string><key>URLString</key><string>javascript:alert(1)</string></dict></array></dict></array></dict></plist>"#;
        let value = plist::Value::from_reader_xml(xml.as_slice()).unwrap();
        let mut binary = Vec::new();
        value.to_writer_binary(&mut binary).unwrap();
        for bytes in [xml.to_vec(), binary] {
            let path = root.join("Bookmarks.plist");
            fs::write(&path, &bytes).unwrap();
            let BrowserImportState::Ready { bookmarks } =
                probe_browser_import("darwin", "Safari", |_| Some(home.clone())).unwrap()
            else {
                panic!("Safari must be ready");
            };
            assert_eq!(bookmarks.len(), 1);
            assert_eq!(bookmarks[0].title, "Safari fixture");
            assert_eq!(bookmarks[0].folder_path, ["Research"]);
            assert_eq!(fs::read(&path).unwrap(), bytes);
        }
        fs::remove_dir_all(home).unwrap();
    }
    #[test]
    fn account_only_and_dual_bookmark_stores_are_read_without_writes() {
        let home = temp_root();
        let root = home.join("Library/Application Support/Google/Chrome");
        let account_only = root.join("Default");
        let dual = root.join("Profile 1");
        let body = |name: &str| {
            format!(
                r#"{{"roots":{{"bar":{{"type":"folder","name":"Research","children":[{{"type":"url","name":"{name}","url":"https://example.org/{name}"}}]}}}}}}"#
            )
        };
        let stores = [
            (account_only.join("AccountBookmarks"), body("account-only")),
            (dual.join("Bookmarks"), body("local")),
            (dual.join("AccountBookmarks"), body("account")),
        ];
        for (path, data) in &stores {
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, data).unwrap();
        }
        let sources = browser_sources_with_errors(
            "darwin",
            |_| Some(home.clone()),
            Some("Chrome"),
            |_, error| panic!("{error}"),
        );
        assert_eq!(sources.len(), 2);
        assert_eq!(sources[0].source.id, "chrome:Default");
        assert_eq!(
            source_bookmarks(&sources[0]).unwrap()[0].title,
            "account-only"
        );
        assert_eq!(
            source_bookmarks(&sources[1])
                .unwrap()
                .iter()
                .map(|row| row.title.as_str())
                .collect::<Vec<_>>(),
            ["local", "account"]
        );
        for (path, data) in &stores {
            assert_eq!(&fs::read_to_string(path).unwrap(), data);
        }
        fs::remove_dir_all(home).unwrap();
    }
    #[test]
    fn selected_browser_discovery_never_probes_other_browser_roots() {
        let home = temp_root();
        let profile = home.join("Library/Application Support/Google/Chrome/Default");
        fs::create_dir_all(&profile).unwrap();
        fs::write(profile.join("Bookmarks"), "{}").unwrap();
        let mut failures = Vec::new();
        let sources = browser_sources_with_errors(
            "darwin",
            |_| Some(home.clone()),
            Some("Chrome"),
            |browser, error| {
                failures.push((browser.to_owned(), error.kind()));
            },
        );
        assert_eq!(sources.len(), 1);
        assert_eq!(sources[0].source.browser, "Chrome");
        assert!(
            failures.is_empty(),
            "unselected missing roots must never be probed"
        );
        fs::remove_dir_all(home).unwrap();
    }
    #[test]
    fn discovery_reports_io_failures_without_inventing_profiles() {
        let home = temp_root();
        let root = home.join("Library/Application Support/Google/Chrome");
        fs::create_dir_all(root.parent().unwrap()).unwrap();
        // A file where a profile root directory is expected is a real I/O failure.
        fs::write(&root, "not a directory").unwrap();
        let mut failures = Vec::new();
        let sources = browser_sources_with_errors(
            "darwin",
            |_| Some(home.clone()),
            None,
            |browser, error| {
                failures.push((browser.to_owned(), error.kind()));
            },
        );
        assert!(sources.is_empty());
        assert!(failures
            .iter()
            .any(|(browser, kind)| browser == "Chrome" && *kind != std::io::ErrorKind::NotFound));
        assert!(failures
            .iter()
            .any(|(browser, kind)| browser == "Edge" && *kind == std::io::ErrorKind::NotFound));
        fs::remove_dir_all(home).unwrap();
    }
    #[test]
    fn firefox_queries_bookmarks_not_history_and_does_not_write() {
        let root = temp_root();
        let path = root.join("places.sqlite");
        let db = Connection::open(&path).unwrap();
        db.execute_batch("CREATE TABLE moz_places(id INTEGER PRIMARY KEY, url TEXT, title TEXT); CREATE TABLE moz_bookmarks(id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER, parent INTEGER, title TEXT, guid TEXT, dateAdded INTEGER); INSERT INTO moz_places VALUES(1,'https://example.org','Page'),(2,'https://history-only.org','History'); INSERT INTO moz_bookmarks VALUES(1,2,NULL,0,'Root','root________',0),(2,2,NULL,1,'Research','folder______',0),(3,1,1,2,'My title','link________',1700000000000000);").unwrap();
        drop(db);
        let before = fs::read(&path).unwrap();
        let items = firefox_bookmarks(&path).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "My title");
        assert_eq!(items[0].folder_path, ["Root", "Research"]);
        assert_eq!(before, fs::read(&path).unwrap());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn firefox_exclusive_lock_recovers_after_browser_releases_database() {
        let root = temp_root();
        let path = root.join("places.sqlite");
        let db = Connection::open(&path).unwrap();
        db.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE moz_places(id INTEGER PRIMARY KEY, url TEXT, title TEXT); CREATE TABLE moz_bookmarks(id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER, parent INTEGER, title TEXT, guid TEXT, dateAdded INTEGER); INSERT INTO moz_places VALUES(1,'https://example.org','Page'); INSERT INTO moz_bookmarks VALUES(1,1,1,0,'Saved','link________',0); PRAGMA locking_mode=EXCLUSIVE; BEGIN EXCLUSIVE;").unwrap();
        let error = firefox_bookmarks(&path).unwrap_err();
        assert!(error.contains("Quit Firefox"), "{error}");
        assert!(!error.contains("format"));
        db.execute_batch("ROLLBACK").unwrap();
        drop(db);
        let before = fs::read(&path).unwrap();
        let items = firefox_bookmarks(&path).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "Saved");
        assert_eq!(before, fs::read(&path).unwrap());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn firefox_invalid_database_is_not_reported_as_busy() {
        let root = temp_root();
        let path = root.join("places.sqlite");
        fs::write(&path, b"invalid database").unwrap();
        let error = firefox_bookmarks(&path).unwrap_err();
        assert!(error.contains("could not be read"));
        assert!(!error.contains("is using its bookmarks"));
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn metadata_is_plain_text_and_ignores_navigation() {
        let result = extract_preview(
            r#"<title>A &amp; B</title><link rel="icon" href="/icon.png"><main><nav><p>Navigation</p></nav><h1>Headline</h1><p>Useful <b>text</b></p><script>danger()</script></main>"#,
            &Url::parse("https://example.org").unwrap(),
        );
        assert_eq!(result.title, "A & B");
        assert!(result.content.contains("Useful text"));
        assert!(!result.content.contains("Navigation"));
        assert!(!result.content.contains("danger"));
        assert_eq!(
            result.favicon_url.as_deref(),
            Some("https://example.org/icon.png")
        );
    }
    #[test]
    fn metadata_accepts_public_cdn_icons_and_distinguishes_page_covers() {
        let result = extract_preview(
            r#"<title>A page</title><link rel="icon" href="https://cdn.example.org/icon.png"><meta property="og:image" content="/cover.jpg">"#,
            &Url::parse("https://example.org/post").unwrap(),
        );
        assert_eq!(
            result.favicon_url.as_deref(),
            Some("https://cdn.example.org/icon.png")
        );
        assert_eq!(
            result.cover_url.as_deref(),
            Some("https://example.org/cover.jpg")
        );
    }
    #[test]
    fn bookmark_icons_read_only_query_exact_bookmarks_without_copying_a_live_database() {
        let root = temp_root();
        let path = root.join("Favicons");
        let db = Connection::open(&path).unwrap();
        db.execute_batch("CREATE TABLE icon_mapping(page_url TEXT,icon_id INTEGER); CREATE TABLE favicon_bitmaps(icon_id INTEGER,image_data BLOB,width INTEGER); INSERT INTO icon_mapping VALUES('https://example.org/',1),('https://history-only.org/',2);").unwrap();
        let mut png = Vec::new();
        image::DynamicImage::new_rgba8(32, 32)
            .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
            .unwrap();
        db.execute("INSERT INTO favicon_bitmaps VALUES(1,?1,32)", [&png])
            .unwrap();
        drop(db);
        let before = fs::read(&path).unwrap();
        let mut items = vec![
            bookmark("Page", "https://example.org/", &[], None).unwrap(),
            bookmark("Other", "https://other.org/", &[], None).unwrap(),
        ];
        cached_bookmark_icons(&root.join("Bookmarks"), &mut items);
        assert!(items[0]
            .favicon_url
            .as_ref()
            .unwrap()
            .starts_with("data:image/png;base64,"));
        assert!(items[1].favicon_url.is_none());
        assert_eq!(before, fs::read(&path).unwrap());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn lookup_rejects_local_targets_and_credentials() {
        for value in [
            "127.0.0.1",
            "10.0.0.1",
            "169.254.169.254",
            "100.64.0.1",
            "::1",
            "::ffff:127.0.0.1",
            "2001:db8::1",
            "2002:7f00:1::",
        ] {
            assert!(!public_ip(value.parse().unwrap()), "{value}");
        }
        assert!(public_ip("8.8.8.8".parse().unwrap()));
        assert!(web_url("file:///secret").is_err());
        assert!(web_url("https://user:password@example.org").is_err());
    }
    #[test]
    fn firefox_includes_toolbar_menu_unfiled_mobile_and_live_wal_but_not_tag_copies() {
        let root = temp_root();
        let path = root.join("places.sqlite");
        let db = Connection::open(&path).unwrap();
        db.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE moz_places(id INTEGER PRIMARY KEY, url TEXT, title TEXT); CREATE TABLE moz_bookmarks(id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER, parent INTEGER, title TEXT, guid TEXT, dateAdded INTEGER); INSERT INTO moz_bookmarks VALUES(1,2,NULL,0,'','root________',0),(2,2,NULL,1,'Toolbar','toolbar_____',0),(3,2,NULL,1,'Menu','menu________',0),(4,2,NULL,1,'Other','unfiled_____',0),(5,2,NULL,1,'Mobile','mobile______',0),(6,2,NULL,1,'Tags','tags________',0),(7,2,NULL,6,'Research','tag-folder__',0);").unwrap();
        for (id, parent) in [(10, 2), (11, 3), (12, 4), (13, 5), (14, 7)] {
            db.execute(
                "INSERT INTO moz_places VALUES(?1,?2,'Page')",
                rusqlite::params![id, format!("https://example.org/{id}")],
            )
            .unwrap();
            db.execute(
                "INSERT INTO moz_bookmarks VALUES(?1,1,?1,?2,'Page',?3,1700000000000000)",
                rusqlite::params![id, parent, format!("link-{id}")],
            )
            .unwrap();
        }
        // Keep the writer open: the reader must see committed rows in its WAL.
        let before = fs::read(&path).unwrap();
        let rows = firefox_bookmarks(&path).unwrap();
        assert_eq!(rows.len(), 4);
        assert_eq!(
            rows.iter()
                .map(|row| row.folder_path[0].as_str())
                .collect::<Vec<_>>(),
            ["Toolbar", "Menu", "Other", "Mobile"]
        );
        assert_eq!(before, fs::read(&path).unwrap());
        drop(db);
        fs::remove_dir_all(root).unwrap();
    }

}
