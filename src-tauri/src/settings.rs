//! Desktop preferences. UI choices stay small; OS effects are applied and
//! validated before a preference is committed.
use crate::library::LibraryState;
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use std::{fs, path::Path, sync::Mutex, time::Duration};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

const KEY: &str = "desktop_preferences_v1";
// Another entry point may move the shared library while this window is idle.
// Follow it on activation, using the existing restart path, not a polling worker.
pub fn follow_library_move(app: &AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static CHECKING: AtomicBool = AtomicBool::new(false);
    let Some(state) = app.try_state::<LibraryState>() else {
        return;
    };
    let Some(root) = state.database_path().parent() else {
        return;
    };
    if CHECKING.swap(true, Ordering::AcqRel) {
        return;
    }
    let root = root.to_path_buf();
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let changed = crate::library_location::resolve(&root).is_ok_and(|current| current != root);
        CHECKING.store(false, Ordering::Release);
        if changed {
            let handle = app.clone();
            let _ = app.run_on_main_thread(move || handle.restart());
        }
    });
}
pub const SHORTCUTS: [&str; 4] = ["Ctrl+Shift+Space", "Ctrl+Alt+Space", "Alt+Shift+Space", ""];

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    System,
    #[default]
    En,
    Zh,
}
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Preferences {
    pub language: Language,
    pub theme: Theme,
    pub shortcut: String,
    #[serde(default = "default_floating_window")]
    pub floating_window: bool,
}
fn default_floating_window() -> bool {
    true
}
impl Default for Preferences {
    fn default() -> Self {
        Self {
            language: Language::En,
            theme: Theme::System,
            shortcut: SHORTCUTS[0].into(),
            floating_window: true,
        }
    }
}
pub struct SettingsState(pub Mutex<()>);
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsInfo {
    preferences: Preferences,
    launch_at_login: bool,
    version: &'static str,
    github_url: Option<String>,
    system_language: &'static str,
}

pub fn read(state: &LibraryState) -> Result<Preferences, String> {
    let db = state
        .connection
        .lock()
        .map_err(|_| "Settings are busy. Try again.".to_string())?;
    let raw: Option<String> = db
        .query_row("SELECT value FROM app_meta WHERE key=?1", [KEY], |r| {
            r.get(0)
        })
        .optional()
        .map_err(|e| e.to_string())?;
    // A corrupt preference must not prevent opening the user's collection.
    // Keep the bad row untouched until the user explicitly saves a valid choice.
    let prefs: Preferences = raw
        .and_then(|v| serde_json::from_str(&v).ok())
        .unwrap_or_default();
    Ok(if validate(&prefs).is_ok() {
        prefs
    } else {
        Preferences::default()
    })
}
fn validate(prefs: &Preferences) -> Result<(), String> {
    if !SHORTCUTS.contains(&prefs.shortcut.as_str()) {
        return Err("Choose a supported shortcut.".into());
    }
    Ok(())
}
pub(crate) fn github_repository() -> Option<String> {
    let links: serde_json::Value =
        serde_json::from_str(include_str!("../product-links.json")).ok()?;
    let repo = links.get("githubRepository")?.as_str()?;
    let parts: Vec<_> = repo.split('/').collect();
    (parts.len() == 2
        && parts.iter().all(|v| {
            !v.is_empty()
                && *v != "."
                && *v != ".."
                && v.chars()
                    .all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c))
        }))
    .then(|| repo.to_string())
}
#[tauri::command]
pub async fn get_desktop_settings(app: AppHandle) -> Result<SettingsInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LibraryState>();
        Ok(SettingsInfo {
            preferences: read(&state)?,
            launch_at_login: startup::enabled()?,
            version: env!("CARGO_PKG_VERSION"),
            github_url: github_repository().map(|r| format!("https://github.com/{r}")),
            system_language: system_language(),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn save_desktop_preferences(
    preferences: Preferences,
    app: AppHandle,
) -> Result<Preferences, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LibraryState>();
        let settings = app.state::<SettingsState>();
        let _serial = settings
            .0
            .lock()
            .map_err(|_| "Settings are busy. Try again.".to_string())?;
        validate(&preferences)?;
        let old = read(&state)?;
        let changed = preferences.shortcut != old.shortcut;
        if changed && !preferences.shortcut.is_empty() {
            app.global_shortcut()
                .register(preferences.shortcut.as_str())
                .map_err(|_| {
                    "This shortcut is in use by another app. Choose another shortcut.".to_string()
                })?;
        }
        let result = (|| {
            let db = state
                .connection
                .lock()
                .map_err(|_| "Settings are busy. Try again.".to_string())?;
            db.execute(
                "INSERT INTO app_meta(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                rusqlite::params![KEY, serde_json::to_string(&preferences).map_err(|e| e.to_string())?],
            ).map_err(|e| e.to_string())?;
            Ok::<_, String>(())
        })();
        if let Err(error) = result {
            if changed && !preferences.shortcut.is_empty() {
                let _ = app
                    .global_shortcut()
                    .unregister(preferences.shortcut.as_str());
            }
            return Err(error);
        }
        if old.floating_window != preferences.floating_window {
            if let Err(error) = crate::desktop_windows::set_floating_enabled(&app, preferences.floating_window) {
                // Roll back the durable choice if the native policy cannot commit.
                let db = state.connection.lock().map_err(|_| "Settings are busy. Try again.")?;
                db.execute(
                    "UPDATE app_meta SET value=?1 WHERE key=?2",
                    rusqlite::params![serde_json::to_string(&old).map_err(|e| e.to_string())?, KEY],
                ).map_err(|e| e.to_string())?;
                if changed && !preferences.shortcut.is_empty() {
                    let _ = app.global_shortcut().unregister(preferences.shortcut.as_str());
                }
                return Err(error);
            }
        }
        if changed && !old.shortcut.is_empty() {
            let _ = app.global_shortcut().unregister(old.shortcut.as_str());
        }
        update_tray(&app, &preferences);
        let _ = app.emit("desktop-preferences-changed", &preferences);
        Ok(preferences)
    }).await.map_err(|e| e.to_string())?
}
pub fn update_tray(app: &AppHandle, preferences: &Preferences) {
    let chinese = preferences.language == Language::Zh
        || (preferences.language == Language::System && system_language() == "zh");
    let _ = crate::lifecycle::set_tray_language(app, chinese);
    if let Some(tray) = app.tray_by_id("stashdock") {
        let label = if preferences.shortcut.is_empty() {
            "StashDock".into()
        } else {
            format!("StashDock · {}", preferences.shortcut)
        };
        let _ = tray.set_tooltip(Some(label));
    }
}
fn system_language() -> &'static str {
    #[cfg(windows)]
    let system_chinese =
        unsafe { windows_sys::Win32::Globalization::GetUserDefaultUILanguage() & 0x03ff == 0x0004 };
    #[cfg(not(windows))]
    let system_chinese = false;
    if system_chinese {
        "zh"
    } else {
        "en"
    }
}
#[tauri::command]
pub async fn set_launch_at_login(enabled: bool, app: AppHandle) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let settings = app.state::<SettingsState>();
        let _serial = settings
            .0
            .lock()
            .map_err(|_| "Settings are busy. Try again.".to_string())?;
        startup::set(enabled)?;
        startup::enabled()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageInfo {
    path: String,
    bytes: u64,
    references: i64,
}
fn folder_bytes(path: &Path) -> Result<u64, String> {
    let mut total = 0u64;
    for entry in fs::read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = fs::symlink_metadata(entry.path()).map_err(|e| e.to_string())?;
        if meta.file_type().is_symlink() {
            continue;
        }
        // Only the managed assets directory, never profiles/screenshot runtimes
        // or arbitrary children of a user-selected folder.
        if meta.is_file() {
            total = total.saturating_add(meta.len());
        }
    }
    Ok(total)
}
#[tauri::command]
pub async fn get_storage_info(app: AppHandle) -> Result<StorageInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LibraryState>();
        let root = state
            .database_path()
            .parent()
            .ok_or("The library location is unavailable.")?;
        let references = state
            .connection
            .lock()
            .map_err(|_| "The library is busy.")?
            .query_row("SELECT COUNT(*) FROM stash_items", [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        let database_bytes = [
            "stashdock.sqlite3",
            "stashdock.sqlite3-wal",
            "stashdock.sqlite3-shm",
        ]
        .iter()
        .filter_map(|name| fs::metadata(root.join(name)).ok())
        .map(|m| m.len())
        .sum::<u64>();
        Ok(StorageInfo {
            path: crate::library_location::display_path(root),
            bytes: database_bytes.saturating_add(folder_bytes(&root.join("assets"))?),
            references,
        })
    })
    .await
    .map_err(|_| "Storage details could not be read. Try again.".to_string())?
}
#[tauri::command]
pub fn open_storage_folder(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let state = app.state::<LibraryState>();
    app.opener()
        .open_path(
            state
                .database_path()
                .parent()
                .ok_or("The library location is unavailable.")?
                .to_string_lossy(),
            None::<&str>,
        )
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn move_library(path: String, app: AppHandle) -> Result<String, String> {
    if path.len() > 32768 {
        return Err("The folder path is too long.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let settings = app.state::<SettingsState>();
        let _serial = settings
            .0
            .lock()
            .map_err(|_| "Settings are busy. Try again.")?;
        let state = app.state::<LibraryState>();
        let root = state
            .database_path()
            .parent()
            .ok_or("The library location is unavailable.")?;
        let moved = crate::library_location::relocate(root, Path::new(&path))?;
        crate::web_preview::stop(&app);
        Ok(crate::library_location::display_path(&moved))
    })
    .await
    .map_err(|_| "The library could not be moved. Your original files are retained.".to_string())?
}
#[tauri::command]
pub fn restart_desktop(app: AppHandle) {
    app.restart();
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    status: &'static str,
    version: Option<String>,
    url: Option<String>,
}
#[tauri::command]
pub async fn check_desktop_updates() -> Result<UpdateInfo, String> {
    let Some(repo) = github_repository() else {
        return Ok(UpdateInfo {
            status: "unconfigured",
            version: None,
            url: None,
        });
    };
    tauri::async_runtime::spawn_blocking(move || {
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(12))
            .user_agent(concat!("StashDock/", env!("CARGO_PKG_VERSION")))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|e| e.to_string())?;
        let mut response = client
            .get(format!(
                "https://api.github.com/repos/{repo}/releases/latest"
            ))
            .send()
            .map_err(|_| "Updates could not be checked. Check your connection and try again.")?
            .error_for_status()
            .map_err(|_| "Updates could not be checked. Try again later.")?;
        // GitHub release bodies are untrusted and bounded, never executable.
        use std::io::Read;
        let mut raw = String::new();
        response
            .by_ref()
            .take(1_000_001)
            .read_to_string(&mut raw)
            .map_err(|e| e.to_string())?;
        if raw.len() > 1_000_000 {
            return Err("The update response is too large.".into());
        }
        let value: serde_json::Value =
            serde_json::from_str(&raw).map_err(|_| "The update response could not be read.")?;
        let tag = value["tag_name"]
            .as_str()
            .ok_or("The release version is missing.")?;
        let newer = newer_version(tag, env!("CARGO_PKG_VERSION"))?;
        Ok(UpdateInfo {
            status: if newer { "available" } else { "current" },
            version: Some(tag.into()),
            url: Some(format!("https://github.com/{repo}/releases/latest")),
        })
    })
    .await
    .map_err(|_| "Updates could not be checked. Try again.".to_string())?
}
fn newer_version(candidate: &str, current: &str) -> Result<bool, String> {
    fn parse(value: &str) -> Option<[u64; 3]> {
        let values: Vec<_> = value
            .strip_prefix('v')
            .unwrap_or(value)
            .split('.')
            .map(str::parse::<u64>)
            .collect::<Result<_, _>>()
            .ok()?;
        values.try_into().ok()
    }
    Ok(
        parse(candidate).ok_or("The release version is not supported.")?
            > parse(current).ok_or("The installed version is invalid.")?,
    )
}

#[cfg(windows)]
mod startup {
    use std::{os::windows::process::CommandExt, process::Command};
    const KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
    fn command() -> Command {
        let mut c = Command::new("reg.exe");
        c.creation_flags(0x08000000);
        c
    }
    pub fn enabled() -> Result<bool, String> {
        let result = command()
            .args(["query", KEY, "/v", "StashDock"])
            .output()
            .map_err(|_| "Windows startup settings could not be read.")?;
        Ok(result.status.success())
    }
    pub fn set(enabled: bool) -> Result<(), String> {
        if !enabled && !self::enabled()? {
            return Ok(());
        }
        let mut c = command();
        if enabled {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            c.args([
                "add",
                KEY,
                "/v",
                "StashDock",
                "/t",
                "REG_SZ",
                "/d",
                &format!("\"{}\"", exe.display()),
                "/f",
            ]);
        } else {
            c.args(["delete", KEY, "/v", "StashDock", "/f"]);
        }
        if !c
            .output()
            .map_err(|_| "Windows startup settings could not be changed.")?
            .status
            .success()
        {
            return Err("Windows startup settings could not be changed. Try again.".into());
        }
        Ok(())
    }
}
#[cfg(not(windows))]
mod startup {
    pub fn enabled() -> Result<bool, String> {
        Ok(false)
    }
    pub fn set(_: bool) -> Result<(), String> {
        Err("Launch at login is only available on Windows.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_and_shortcuts_are_validated() {
        assert!(validate(&Preferences::default()).is_ok());
        assert_eq!(Preferences::default().language, Language::En);
        assert_eq!(Language::default(), Language::En);
        let mut prefs = Preferences::default();
        prefs.shortcut = "invalid shortcut".into();
        assert!(validate(&prefs).is_err());
        assert!(serde_json::from_str::<Preferences>(
            r#"{"language":"other","theme":"light","shortcut":""}"#
        )
        .is_err());
    }
    #[test]
    fn floating_preference_upgrades_legacy_settings_without_resetting_them() {
        let old: Preferences =
            serde_json::from_str(r#"{"language":"zh","theme":"dark","shortcut":""}"#).unwrap();
        assert!(old.floating_window);
        assert_eq!(old.language, Language::Zh);
        assert_eq!(old.theme, Theme::Dark);
        let off: Preferences = serde_json::from_str(
            r#"{"language":"en","theme":"system","shortcut":"","floatingWindow":false}"#,
        )
        .unwrap();
        assert!(!off.floating_window);
        assert!(
            !serde_json::from_str::<Preferences>(&serde_json::to_string(&off).unwrap())
                .unwrap()
                .floating_window
        );
        assert!(serde_json::from_str::<Preferences>(
            r#"{"language":"en","theme":"system","shortcut":"","floatingWindow":"false"}"#
        )
        .is_err());
    }
    #[test]
    fn updates_compare_numbers_not_strings_and_reject_unexpected_versions() {
        assert!(newer_version("v0.10.0", "0.2.2").unwrap());
        assert!(!newer_version("0.2.2", "0.2.2").unwrap());
        assert!(newer_version("0.3.0-beta", "0.2.2").is_err());
        assert_eq!(
            github_repository().as_deref(),
            Some("GaryYang12345/StashDock")
        );
    }
}
