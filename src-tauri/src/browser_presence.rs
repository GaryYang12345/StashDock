//! This extension's enablement metadata only. No cookies or browsing data.
use serde_json::Value;
use std::path::PathBuf;
pub(crate) fn firefox_enabled(value: &Value, id: &str) -> bool {
    value["addons"].as_array().is_some_and(|addons| {
        addons.iter().any(|addon| {
            addon["id"].as_str() == Some(id)
                && matches!(
                    addon["defaultLocale"]["name"].as_str(),
                    Some("StashDock" | "StashDock Companion")
                )
                && addon["active"].as_bool() == Some(true)
                && addon["userDisabled"].as_bool() != Some(true)
                && addon["appDisabled"].as_bool() != Some(true)
                && addon["pendingUninstall"].as_bool() != Some(true)
        })
    })
}
fn firefox_detected(root: PathBuf, id: &str) -> bool {
    let Ok(profiles) = std::fs::read_dir(root) else {
        return false;
    };
    let mut bytes = 0;
    profiles
        .flatten()
        .filter(|p| p.file_type().is_ok_and(|t| t.is_dir()))
        .take(32)
        .any(|profile| {
            let path = profile.path().join("extensions.json");
            let Ok(meta) = std::fs::metadata(&path) else {
                return false;
            };
            bytes += meta.len();
            meta.len() <= 16_000_000
                && bytes <= 64_000_000
                && std::fs::read(path)
                    .ok()
                    .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
                    .is_some_and(|value| firefox_enabled(&value, id))
        })
}
pub(crate) fn enabled(value: &Value, id: &str) -> bool {
    let entry = &value["extensions"]["settings"][id];
    matches!(
        entry["manifest"]["name"].as_str(),
        Some("StashDock" | "StashDock Companion")
    ) && (entry["state"].is_null() || entry["state"].as_i64() == Some(1))
        && (entry["disable_reasons"].is_null()
            || entry["disable_reasons"].as_i64() == Some(0)
            || entry["disable_reasons"]
                .as_array()
                .is_some_and(Vec::is_empty))
}
pub(crate) fn detected(browser: &str, id: &str) -> bool {
    if !crate::integrations::valid_extension_id(browser, id) {
        return false;
    }
    if browser == "safari" {
        #[cfg(target_os = "macos")]
        return crate::safari_services::enabled(id);
        #[cfg(not(target_os = "macos"))]
        return false;
    }
    let Some(home) =
        std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from)
    else {
        return false;
    };
    if browser == "firefox" {
        let root = if cfg!(windows) {
            std::env::var_os("APPDATA")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join("AppData/Roaming"))
                .join("Mozilla/Firefox/Profiles")
        } else if cfg!(target_os = "macos") {
            home.join("Library/Application Support/Firefox/Profiles")
        } else {
            home.join(".mozilla/firefox")
        };
        return firefox_detected(root, id);
    }
    let root = if cfg!(windows) {
        std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join("AppData/Local"))
            .join(if browser == "chrome" {
                "Google/Chrome/User Data"
            } else {
                "Microsoft/Edge/User Data"
            })
    } else if cfg!(target_os = "macos") {
        home.join("Library/Application Support")
            .join(if browser == "chrome" {
                "Google/Chrome"
            } else {
                "Microsoft Edge"
            })
    } else {
        std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".config"))
            .join(if browser == "chrome" {
                "google-chrome"
            } else {
                "microsoft-edge"
            })
    };
    let Ok(profiles) = std::fs::read_dir(root) else {
        return false;
    };
    let mut bytes = 0;
    profiles
        .flatten()
        .filter(|p| {
            let name = p.file_name().to_string_lossy().into_owned();
            name == "Default"
                || name
                    .strip_prefix("Profile ")
                    .is_some_and(|s| !s.is_empty() && s.bytes().all(|c| c.is_ascii_digit()))
        })
        .take(32)
        .any(|profile| {
            let secure = profile.path().join("Secure Preferences");
            let path = if secure.is_file() {
                secure
            } else {
                profile.path().join("Preferences")
            };
            let Ok(metadata) = std::fs::metadata(&path) else {
                return false;
            };
            bytes += metadata.len();
            if metadata.len() > 16_000_000 || bytes > 64_000_000 {
                return false;
            }
            std::fs::read(path)
                .ok()
                .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
                .is_some_and(|mut value| {
                    let entry = &value["extensions"]["settings"][id];
                    if entry.is_object() && !entry["manifest"]["name"].is_string() {
                        let Some(raw) = entry["path"].as_str() else {
                            return false;
                        };
                        let dir = PathBuf::from(raw);
                        let dir = if dir.is_absolute() {
                            dir
                        } else if raw.replace('\\', "/").starts_with(&format!("{id}/")) {
                            profile.path().join("Extensions").join(dir)
                        } else {
                            return false;
                        };
                        let manifest = dir.join("manifest.json");
                        if !std::fs::metadata(&manifest).is_ok_and(|m| m.len() <= 1_000_000) {
                            return false;
                        }
                        let Some(manifest) = std::fs::read(manifest)
                            .ok()
                            .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
                        else {
                            return false;
                        };
                        value["extensions"]["settings"][id]["manifest"] = manifest;
                    }
                    enabled(&value, id)
                })
        })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn firefox_requires_current_active_matching_addon() {
        let mut value = serde_json::json!({"addons":[{"id":"test@addon","defaultLocale":{"name":"StashDock Companion"},"active":true,"userDisabled":false}]});
        assert!(firefox_enabled(&value, "test@addon"));
        value["addons"][0]["userDisabled"] = Value::Bool(true);
        assert!(!firefox_enabled(&value, "test@addon"));
        value["addons"][0]["userDisabled"] = Value::Bool(false);
        value["addons"][0]["pendingUninstall"] = Value::Bool(true);
        assert!(!firefox_enabled(&value, "test@addon"));
        assert!(!firefox_enabled(&value, "other@addon"));
    }
    #[test]
    fn enabled_and_disabled_are_current_configuration_not_handshake_age() {
        let mut value = serde_json::json!({"extensions":{"settings":{"id":{"manifest":{"name":"StashDock Companion"},"state":1,"disable_reasons":[]}}}});
        assert!(enabled(&value, "id"));
        value["extensions"]["settings"]["id"]["disable_reasons"] = serde_json::json!([1]);
        assert!(!enabled(&value, "id"));
        assert!(!enabled(&value, "removed"));
        assert!(!detected("chrome", "../../anything"));
    }
}
