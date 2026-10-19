//! Read only the host's explicit StashDock configuration. Cached packages are
//! not installation evidence; uninstall/disable must take effect on every read.
use std::path::{Path, PathBuf};

fn configuration_path() -> Option<PathBuf> {
    std::env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
                .map(|home| PathBuf::from(home).join(".codex"))
        })
        .map(|root| root.join("config.toml"))
}

pub(crate) fn configured(text: &str, manifest: &Path) -> bool {
    let Ok(config) = text.parse::<toml::Value>() else {
        return false;
    };
    let Some(plugins) = config.get("plugins").and_then(toml::Value::as_table) else {
        return false;
    };
    let path = manifest.to_string_lossy().replace('\\', "/");
    let marketplace = path
        .split("/plugins/cache/")
        .nth(1)
        .and_then(|tail| tail.split_once("/stashdock/"))
        .map(|(marketplace, _)| marketplace);
    plugins.iter().any(|(key, plugin)| {
        let matches = marketplace.map_or_else(
            || key == "stashdock" || key.starts_with("stashdock@"),
            |marketplace| key == &format!("stashdock@{marketplace}"),
        );
        matches
            && plugin.get("enabled").and_then(toml::Value::as_bool) == Some(true)
            && plugin
                .get("mcp_servers")
                .and_then(|v| v.get("stashdock"))
                .and_then(|v| v.get("enabled"))
                .and_then(toml::Value::as_bool)
                != Some(false)
    })
}

pub(crate) fn detected(manifest: &Path) -> bool {
    let Some(path) = configuration_path() else {
        return false;
    };
    let Ok(metadata) = std::fs::metadata(&path) else {
        return false;
    };
    if metadata.len() > 2_000_000 {
        return false;
    }
    let Ok(text) = std::fs::read_to_string(path) else {
        return false;
    };
    configured(&text, manifest)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cached_plugins_require_explicit_enabled_registration() {
        let path = Path::new(
            "C:/Users/test/.codex/plugins/cache/personal/stashdock/1/.codex-plugin/plugin.json",
        );
        assert!(!configured("", path));
        assert!(!configured(
            "[plugins.\"stashdock@personal\"]\nenabled=false",
            path
        ));
        assert!(configured(
            "[plugins.\"stashdock@personal\"]\nenabled=true",
            path
        ));
        assert!(!configured(
            "[plugins.\"stashdock@another\"]\nenabled=true",
            path
        ));
        assert!(!configured("[plugins.\"stashdock@personal\"]\nenabled=true\n[plugins.\"stashdock@personal\".mcp_servers.stashdock]\nenabled=false", path));
        assert!(!configured("[broken", path));
    }
}
