use crate::library::LibraryState;
use rusqlite::{Connection, OptionalExtension};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

pub(crate) fn valid_extension_id(browser: &str, id: &str) -> bool {
    if browser == "firefox" {
        let config: Value = serde_json::from_str(include_str!("../product-links.json"))
            .expect("valid product links");
        return config["browserExtensions"]["firefox"]["id"].as_str() == Some(id);
    }
    ["chrome", "edge"].contains(&browser)
        && id.len() == 32
        && id.bytes().all(|v| (b'a'..=b'p').contains(&v))
}
pub(crate) fn browser_registration(
    browser: &str,
    origin: Option<&str>,
    reported: Option<&str>,
) -> Result<Option<String>, String> {
    if !["chrome", "edge", "firefox"].contains(&browser) {
        return Err("Unsupported browser.".into());
    }
    if browser == "firefox" {
        if origin.is_some_and(|value| {
            !value
                .strip_prefix("moz-extension://")
                .is_some_and(|id| uuid::Uuid::parse_str(id).is_ok())
        }) || !reported.is_some_and(|id| valid_extension_id(browser, id))
        {
            return Err("Invalid StashDock extension.".into());
        }
        return Ok(reported.map(str::to_owned));
    }
    if origin.is_some_and(|value| !value.starts_with("chrome-extension://")) {
        return Err("Invalid StashDock extension.".into());
    }
    let origin_id = origin.and_then(|value| value.strip_prefix("chrome-extension://"));
    if origin_id.is_some() && reported.is_some() && origin_id != reported {
        return Err("Invalid StashDock extension.".into());
    }
    let id = origin_id.or(reported);
    if id.is_some_and(|id| !valid_extension_id(browser, id)) {
        return Err("Invalid StashDock extension.".into());
    }
    Ok(id.map(str::to_owned))
}

pub fn record(db: &Connection, id: &str, version: &str, path: Option<&str>) -> Result<(), String> {
    record_with_extension(db, id, version, path, None)
}
pub fn record_with_extension(
    db: &Connection,
    id: &str,
    version: &str,
    path: Option<&str>,
    extension_id: Option<&str>,
) -> Result<(), String> {
    if !["desktop", "codex", "chrome", "edge", "firefox", "safari"].contains(&id)
        || version.len() > 40
        || version.is_empty()
        || !version
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || ".+-_".contains(c))
    {
        return Err("Invalid StashDock installation.".into());
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;
    if extension_id.is_some_and(|extension| !valid_extension_id(id, extension)) {
        return Err("Invalid StashDock extension.".into());
    }
    let value = json!({"version":version,"path":path,"seenAt":now,"extensionId":extension_id});
    db.execute("INSERT INTO app_meta(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        rusqlite::params![format!("installation_{id}_v1"), value.to_string()]).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn record_browser_origin(
    db: &Connection,
    browser: &str,
    version: &str,
    extension_id: &str,
    origin: &str,
) -> Result<(), String> {
    record_browser_origin_with_presence(
        db,
        browser,
        version,
        extension_id,
        origin,
        crate::browser_presence::detected,
    )
}

fn record_browser_origin_with_presence(
    db: &Connection,
    browser: &str,
    version: &str,
    extension_id: &str,
    origin: &str,
    browser_enabled: impl FnOnce(&str, &str) -> bool,
) -> Result<(), String> {
    if version.is_empty()
        || version.len() > 40
        || !version
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || ".+-_".contains(character))
    {
        return Err("Invalid StashDock installation.".into());
    }
    let registered = browser_registration(browser, Some(origin), Some(extension_id))?
        .ok_or("Invalid StashDock extension.")?;
    if registered != extension_id {
        return Err("Invalid StashDock extension.".into());
    }
    if !browser_enabled(browser, extension_id) {
        return Err("StashDock is not enabled in this browser.".into());
    }
    let previous: Option<String> = db
        .query_row(
            "SELECT value FROM app_meta WHERE key=?1",
            [format!("installation_{browser}_v1")],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let previous = previous.and_then(|value| serde_json::from_str::<Value>(&value).ok());
    let mut origins: Vec<String> = previous
        .filter(|value| value["extensionId"].as_str() == Some(extension_id))
        .and_then(|value| serde_json::from_value(value["origins"].clone()).ok())
        .unwrap_or_default();
    origins.retain(|value| valid_extension_origin(browser, extension_id, value));
    if !origins.iter().any(|value| value == origin) {
        origins.push(origin.to_string());
    }
    if origins.len() > 16 {
        origins.drain(..origins.len() - 16);
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis() as u64;
    let value =
        json!({"version":version,"seenAt":now,"extensionId":extension_id,"origins":origins});
    db.execute(
        "INSERT INTO app_meta(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        rusqlite::params![format!("installation_{browser}_v1"), value.to_string()],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn valid_extension_origin(browser: &str, extension_id: &str, origin: &str) -> bool {
    if !valid_extension_id(browser, extension_id) {
        return false;
    }
    if browser == "firefox" {
        return origin
            .strip_prefix("moz-extension://")
            .is_some_and(|id| uuid::Uuid::parse_str(id).is_ok());
    }
    origin == format!("chrome-extension://{extension_id}")
}

pub fn browser_origin_allowed(db: &Connection, origin: &str) -> bool {
    ["chrome", "edge", "firefox"].iter().any(|browser| {
        let raw: Option<String> = db
            .query_row(
                "SELECT value FROM app_meta WHERE key=?1",
                [format!("installation_{browser}_v1")],
                |row| row.get(0),
            )
            .optional()
            .ok()
            .flatten();
        let Some(value) = raw.and_then(|value| serde_json::from_str::<Value>(&value).ok()) else {
            return false;
        };
        let Some(extension_id) = value["extensionId"].as_str() else {
            return false;
        };
        valid_extension_origin(browser, extension_id, origin)
            && value["origins"]
                .as_array()
                .is_some_and(|origins| origins.iter().any(|value| value.as_str() == Some(origin)))
    })
}
pub fn read(db: &Connection) -> Result<Value, String> {
    let mut items = Vec::new();
    for id in [
        "chrome", "edge", "firefox", "safari", "codex", "claude", "desktop",
    ] {
        let raw: Option<String> = db
            .query_row(
                "SELECT value FROM app_meta WHERE key=?1",
                [format!("installation_{id}_v1")],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        let value = raw.and_then(|raw| serde_json::from_str::<Value>(&raw).ok());
        let detected = value.as_ref().is_some_and(|v| {
            v["version"].is_string()
                && if let Some(path) = v["path"].as_str() {
                    std::path::Path::new(path).is_absolute()
                        && std::path::Path::new(path).is_file()
                        && (id != "codex"
                            || crate::codex_presence::detected(std::path::Path::new(path)))
                } else {
                    crate::browser_presence::detected(
                        id,
                        v["extensionId"].as_str().unwrap_or_default(),
                    )
                }
        });
        items.push(json!({"id":id,"detected":detected}));
    }
    let config: Value =
        serde_json::from_str(include_str!("../product-links.json")).map_err(|e| e.to_string())?;
    Ok(
        json!({"items":items,"links":config["installationUrls"],"githubUrl":crate::settings::github_repository().map(|repo|format!("https://github.com/{repo}"))}),
    )
}
#[tauri::command]
pub async fn get_integration_status(app: AppHandle) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let library = app.state::<LibraryState>();
        let db = library
            .connection
            .lock()
            .map_err(|_| "The library is busy.")?;
        read(&db)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn firefox_runtime_identity_is_not_its_origin_uuid() {
        let config: Value = serde_json::from_str(include_str!("../product-links.json")).unwrap();
        let id = config["browserExtensions"]["firefox"]["id"]
            .as_str()
            .unwrap();
        let origin = "moz-extension://e9aefaf5-6844-473b-a647-9455e6346978";
        assert_eq!(
            browser_registration("firefox", Some(origin), Some(id)).unwrap(),
            Some(id.to_owned())
        );
        assert!(browser_registration("firefox", Some(origin), Some("other@addon")).is_err());
        assert!(browser_registration("edge", Some(origin), Some(id)).is_err());
        assert!(valid_extension_id("firefox", id));
        assert!(!valid_extension_id("chrome", id));
    }
    #[test]
    fn only_own_confirmed_browser_handshakes_are_detected() {
        let db = Connection::open_in_memory().unwrap();
        db.execute(
            "CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)",
            [],
        )
        .unwrap();
        record(&db, "chrome", "0.4.9", None).unwrap();
        assert!(record(&db, "arbitrary", "1", None).is_err());
        assert!(record(&db, "chrome", "bad version", None).is_err());
        let status = read(&db).unwrap();
        assert_eq!(
            status["items"]
                .as_array()
                .unwrap()
                .iter()
                .find(|v| v["id"] == "chrome")
                .unwrap()["detected"],
            false
        );
        assert_eq!(
            status["items"]
                .as_array()
                .unwrap()
                .iter()
                .find(|v| v["id"] == "codex")
                .unwrap()["detected"],
            false
        );
    }

    #[test]
    fn browser_data_access_is_bound_to_registered_origins() {
        let db = Connection::open_in_memory().unwrap();
        db.execute(
            "CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)",
            [],
        )
        .unwrap();
        let chrome = "a".repeat(32);
        let chrome_origin = format!("chrome-extension://{chrome}");
        record_browser_origin_with_presence(
            &db,
            "chrome",
            "0.4.13",
            &chrome,
            &chrome_origin,
            |_, _| true,
        )
        .unwrap();
        assert!(browser_origin_allowed(&db, &chrome_origin));
        assert!(!browser_origin_allowed(
            &db,
            &format!("chrome-extension://{}", "b".repeat(32))
        ));
        let firefox = "stashdock@stashdock.app";
        let first = "moz-extension://e9aefaf5-6844-473b-a647-9455e6346978";
        let second = "moz-extension://a9aefaf5-6844-473b-a647-9455e6346978";
        record_browser_origin_with_presence(&db, "firefox", "0.4.13", firefox, first, |_, _| true)
            .unwrap();
        record_browser_origin_with_presence(&db, "firefox", "0.4.13", firefox, second, |_, _| true)
            .unwrap();
        assert!(browser_origin_allowed(&db, first));
        assert!(browser_origin_allowed(&db, second));
    }

    #[test]
    fn browser_registration_requires_current_enablement() {
        let db = Connection::open_in_memory().unwrap();
        db.execute(
            "CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)",
            [],
        )
        .unwrap();
        let id = "a".repeat(32);
        let origin = format!("chrome-extension://{id}");
        assert!(record_browser_origin_with_presence(
            &db,
            "chrome",
            "0.4.13",
            &id,
            &origin,
            |_, _| false,
        )
        .is_err());
        assert!(!browser_origin_allowed(&db, &origin));
    }
}
