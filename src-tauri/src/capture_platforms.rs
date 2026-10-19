use crate::library::LibraryState;
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use tauri::State;

const KEY: &str = "capture_platforms_v1";
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapturePlatform {
    id: String,
    name: String,
    host: String,
    url: String,
}

fn normalize(raw: &str) -> Result<CapturePlatform, String> {
    let value = raw.trim();
    if value.is_empty() || value.len() > 2048 {
        return Err("Enter a website link up to 2,048 characters.".into());
    }
    let expanded = if value.contains(":") {
        value.to_string()
    } else {
        format!("https://{value}")
    };
    let url = url::Url::parse(&expanded).map_err(|_| "Enter a valid website link.")?;
    let host = url
        .host_str()
        .ok_or("Enter a valid website link.")?
        .trim_start_matches("www.")
        .to_string();
    if !["http", "https"].contains(&url.scheme())
        || !url.username().is_empty()
        || url.password().is_some()
        || !host.contains('.')
    {
        return Err("Use an http:// or https:// website link without sign-in credentials.".into());
    }
    let url = url.to_string();
    Ok(CapturePlatform {
        id: format!("custom:{url}"),
        name: host.clone(),
        host,
        url,
    })
}
fn read(connection: &rusqlite::Connection) -> Result<Vec<CapturePlatform>, String> {
    let value: Option<String> = connection
        .query_row("SELECT value FROM app_meta WHERE key=?", [KEY], |row| {
            row.get(0)
        })
        .optional()
        .map_err(|e| e.to_string())?;
    value
        .map(|v| serde_json::from_str(&v).map_err(|_| "Saved platforms could not be read.".into()))
        .unwrap_or(Ok(vec![]))
}
#[tauri::command]
pub fn list_capture_platforms(state: State<LibraryState>) -> Result<Vec<CapturePlatform>, String> {
    let connection = state
        .connection
        .lock()
        .map_err(|_| "The library is busy.")?;
    read(&connection)
}
#[tauri::command]
pub fn save_capture_platform(
    state: State<LibraryState>,
    url: String,
) -> Result<Vec<CapturePlatform>, String> {
    let platform = normalize(&url)?;
    let mut connection = state
        .connection
        .lock()
        .map_err(|_| "The library is busy.")?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| e.to_string())?;
    let mut values = read(&transaction)?;
    if !values.iter().any(|value| value.url == platform.url) {
        if values.len() >= 50 {
            return Err("You can save up to 50 custom platforms.".into());
        }
        values.push(platform);
        transaction.execute("INSERT INTO app_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![KEY,serde_json::to_string(&values).map_err(|e|e.to_string())?]).map_err(|e|e.to_string())?;
    }
    transaction.commit().map_err(|e| e.to_string())?;
    Ok(values)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_navigation() {
        assert_eq!(
            normalize("example.com/path").unwrap().url,
            "https://example.com/path"
        );
        for value in [
            "javascript:alert(1)",
            "file:///C:/test",
            "https://name:secret@example.com",
            "",
            "localhost",
        ] {
            assert!(normalize(value).is_err());
        }
    }
}
