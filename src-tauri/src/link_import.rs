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

fn browser_sources(local: &Path, roaming: &Path) -> Vec<SourceFile> {
    let mut sources = Vec::new();
    for (browser, root, firefox) in [
        ("Chrome", local.join("Google/Chrome/User Data"), false),
        ("Edge", local.join("Microsoft/Edge/User Data"), false),
        ("Firefox", roaming.join("Mozilla/Firefox/Profiles"), true),
    ] {
        let Ok(root_absolute) = root.canonicalize() else {
            continue;
        };
        let Ok(entries) = fs::read_dir(&root) else {
            continue;
        };
        let names: Value = fs::read(root.join("Local State"))
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or(Value::Null);
        for entry in entries.flatten() {
            let folder = entry.file_name().to_string_lossy().into_owned();
            if !firefox && folder != "Default" && !folder.starts_with("Profile ")
                && names["profile"]["info_cache"].get(&folder).is_none() {
                continue;
            }
            // Local and account bookmarks are separate live stores in Chromium.
            // Discover a profile even when only its account store exists.
            let files: &[&str] = if firefox { &["places.sqlite"] } else { &["Bookmarks", "AccountBookmarks"] };
            let paths: Vec<_> = files.iter().filter_map(|file| entry.path().join(file).canonicalize().ok())
                .filter(|absolute| absolute.starts_with(&root_absolute) && absolute.is_file()).collect();
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
    let local = std::env::var_os("LOCALAPPDATA")
        .ok_or("Browser import is currently supported on Windows.")?;
    let roaming = std::env::var_os("APPDATA").ok_or("Browser profiles could not be located.")?;
    Ok(browser_sources(Path::new(&local), Path::new(&roaming)))
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
fn firefox_bookmarks(path: &Path) -> Result<Vec<BrowserBookmark>, String> {
    let connection = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|_| "Firefox bookmarks are unavailable. Close Firefox and retry.")?;
    connection
        .busy_timeout(Duration::from_millis(1000))
        .map_err(|e| e.to_string())?;
    // One read transaction keeps folder names and bookmarks in the same snapshot.
    connection
        .execute_batch("BEGIN")
        .map_err(|_| "Firefox bookmarks are busy. Retry in a moment.")?;
    let mut folders = HashMap::new();
    let mut statement = connection
        .prepare("SELECT id, parent, COALESCE(title, ''), guid FROM moz_bookmarks WHERE type = 2")
        .map_err(|_| "This Firefox bookmark format is not supported.")?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    for row in rows {
        let (id, parent, title, guid) = row.map_err(|e| e.to_string())?;
        folders.insert(id, (parent, title, guid));
    }
    let mut statement = connection.prepare("SELECT COALESCE(b.title, p.title, ''), p.url, b.parent, b.dateAdded FROM moz_bookmarks b JOIN moz_places p ON p.id = b.fk WHERE b.type = 1 ORDER BY b.id LIMIT 50001").map_err(|_| "Firefox bookmarks could not be read. Close Firefox and retry.")?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut items = Vec::new();
    for row in rows {
        let (title, url, mut parent, date) =
            row.map_err(|_| "Firefox bookmarks are busy. Retry the import.")?;
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
    tauri::async_runtime::spawn_blocking(browser_sources_snapshot)
        .await
        .map_err(|_| "Browser profiles could not be located.")?
}
#[tauri::command]
pub async fn read_browser_bookmarks(source_id: String) -> Result<Vec<BrowserBookmark>, String> {
    tauri::async_runtime::spawn_blocking(move || browser_bookmarks_snapshot(&source_id))
        .await
        .map_err(|_| "Bookmarks could not be read. Retry the import.")?
}

// Both the Tauri command and independent MCP helper use this exact reader.
pub fn browser_sources_snapshot() -> Result<Vec<BrowserSource>, String> {
    discovered_sources().map(|sources| sources.into_iter().map(|file| file.source).collect())
}
pub fn browser_bookmarks_snapshot(source_id: &str) -> Result<Vec<BrowserBookmark>, String> {
    // The caller provides a discovered opaque id, never a file path.
    let source = discovered_sources()?
        .into_iter()
        .find(|file| file.source.id == source_id)
        .ok_or("This browser profile is no longer available. Reopen Import references.")?;
    read_source(&source)
}

fn read_source(source: &SourceFile) -> Result<Vec<BrowserBookmark>, String> {
    if source.firefox {
        firefox_bookmarks(&source.paths[0])
    } else {
        let mut items = Vec::new();
        for path in &source.paths {
            items.extend(chromium_bookmarks(path)?);
            if items.len() > MAX_BOOKMARKS {
                return Err("This browser profile has too many bookmarks to import at once.".into());
            }
        }
        cached_bookmark_icons(&source.paths[0], &mut items);
        Ok(items)
    }
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
            let rows = read_source(&source).expect("read-only local bookmark adapter");
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
            fs::write(browser_root.join("Local State"), r#"{"profile":{"info_cache":{"Registered work":{"name":"Work"}}}}"#).unwrap();
            let local = r#"{"roots":{"bookmark_bar":{"type":"folder","name":"Toolbar","children":[{"type":"url","name":"Local","url":"https://example.org/local"}]}}}"#;
            let account = r#"{"roots":{"other":{"type":"folder","name":"Account","children":[{"type":"url","name":"Cloud","url":"https://example.org/cloud"}]},"synced":{"type":"folder","name":"Mobile","children":[{"type":"url","name":"Phone","url":"https://example.org/phone"}]}}}"#;
            fs::write(browser_root.join("Default/Bookmarks"), local).unwrap();
            fs::write(browser_root.join("Default/AccountBookmarks"), account).unwrap();
            fs::write(browser_root.join("Registered work/AccountBookmarks"), account).unwrap();
            // Retired backups are not additional live bookmark stores.
            fs::write(browser_root.join("Default/Bookmarks.bak"), account).unwrap();
            let sources = browser_sources(&root, &root);
            let prefix = if browser.contains("Chrome") { "chrome" } else { "edge" };
            let source = sources.iter().find(|s| s.source.id == format!("{prefix}:Default")).unwrap();
            assert_eq!(source.paths.len(), 2);
            let items = read_source(source).unwrap();
            assert_eq!(items.len(), 3);
            assert_eq!(items[0].title, "Local");
            assert!(items.iter().any(|item| item.folder_path == ["Mobile"]));
            let account_only = sources.iter().find(|s| s.source.id == format!("{prefix}:Registered work")).unwrap();
            assert_eq!(account_only.source.profile, "Work");
            assert_eq!(read_source(account_only).unwrap().len(), 2);
            assert_eq!(fs::read_to_string(browser_root.join("Default/AccountBookmarks")).unwrap(), account);
        }
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn discovery_only_reads_supported_profile_files() {
        let root = temp_root();
        let profile = root.join("Google/Chrome/User Data/Default");
        fs::create_dir_all(&profile).unwrap();
        fs::write(profile.join("Bookmarks"), "{}").unwrap();
        let sources = browser_sources(&root, &root);
        assert_eq!(sources.len(), 1);
        assert_eq!(sources[0].source.id, "chrome:Default");
        assert!(!sources[0].firefox);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn firefox_includes_toolbar_menu_unfiled_mobile_and_live_wal_but_not_tag_copies() {
        let root = temp_root();
        let path = root.join("places.sqlite");
        let db = Connection::open(&path).unwrap();
        db.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE moz_places(id INTEGER PRIMARY KEY, url TEXT, title TEXT); CREATE TABLE moz_bookmarks(id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER, parent INTEGER, title TEXT, guid TEXT, dateAdded INTEGER); INSERT INTO moz_bookmarks VALUES(1,2,NULL,0,'','root________',0),(2,2,NULL,1,'Toolbar','toolbar_____',0),(3,2,NULL,1,'Menu','menu________',0),(4,2,NULL,1,'Other','unfiled_____',0),(5,2,NULL,1,'Mobile','mobile______',0),(6,2,NULL,1,'Tags','tags________',0),(7,2,NULL,6,'Research','tag-folder__',0);").unwrap();
        for (id, parent) in [(10, 2), (11, 3), (12, 4), (13, 5), (14, 7)] {
            db.execute("INSERT INTO moz_places VALUES(?1,?2,'Page')", rusqlite::params![id, format!("https://example.org/{id}")]).unwrap();
            db.execute("INSERT INTO moz_bookmarks VALUES(?1,1,?1,?2,'Page',?3,1700000000000000)", rusqlite::params![id, parent, format!("link-{id}")]).unwrap();
        }
        // Keep the writer open: the reader must see committed rows in its WAL.
        let before = fs::read(&path).unwrap();
        let rows = firefox_bookmarks(&path).unwrap();
        assert_eq!(rows.len(), 4);
        assert_eq!(rows.iter().map(|row| row.folder_path[0].as_str()).collect::<Vec<_>>(), ["Toolbar", "Menu", "Other", "Mobile"]);
        assert_eq!(before, fs::read(&path).unwrap());
        drop(db);
        fs::remove_dir_all(root).unwrap();
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
}
