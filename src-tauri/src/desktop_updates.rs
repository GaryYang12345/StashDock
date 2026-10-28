//! Select an actual Desktop installer for this platform, not an unrelated
//! plugin or Windows-only GitHub release. Installation remains user-directed.
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    status: &'static str,
    version: Option<String>,
    url: Option<String>,
}
impl UpdateInfo {
    pub fn unconfigured() -> Self {
        Self {
            status: "unconfigured",
            version: None,
            url: None,
        }
    }
}

fn version(text: &str) -> Option<[u64; 3]> {
    let parts: Vec<_> = text.strip_prefix('v').unwrap_or(text).split('.').collect();
    if parts.len() != 3
        || parts
            .iter()
            .any(|p| p.is_empty() || !p.bytes().all(|c| c.is_ascii_digit()))
    {
        return None;
    }
    Some([
        parts[0].parse().ok()?,
        parts[1].parse().ok()?,
        parts[2].parse().ok()?,
    ])
}

fn installer(name: &str, os: &str, arch: &str) -> Option<[u64; 3]> {
    let (number, suffix) = name.strip_prefix("StashDock_")?.split_once('_')?;
    let compatible = match (os, arch) {
        ("macos", "aarch64") => ["aarch64.dmg", "arm64.dmg", "universal.dmg"].contains(&suffix),
        ("macos", "x86_64") => ["x64.dmg", "x86_64.dmg", "universal.dmg"].contains(&suffix),
        ("windows", "x86_64") => suffix == "x64-setup.exe",
        ("windows", "aarch64") => suffix == "arm64-setup.exe",
        _ => false,
    };
    compatible.then(|| version(number)).flatten()
}

pub fn select(
    releases: &Value,
    repository: &str,
    current: &str,
    os: &str,
    arch: &str,
) -> Result<UpdateInfo, String> {
    let installed = version(current).ok_or("The installed version is invalid.")?;
    let releases = releases
        .as_array()
        .ok_or("The update response could not be read.")?;
    let page_prefix = format!("https://github.com/{repository}/releases/tag/");
    let mut best: Option<([u64; 3], String)> = None;
    for release in releases.iter().take(30) {
        // Only explicitly published, stable releases are eligible.
        if release["draft"].as_bool() != Some(false)
            || release["prerelease"].as_bool() != Some(false)
        {
            continue;
        }
        let Some(page) = release["html_url"].as_str().filter(|page| {
            page.len() <= 2048
                && page
                    .strip_prefix(&page_prefix)
                    .is_some_and(|tag| !tag.is_empty() && !tag.contains(['?', '#', '\r', '\n']))
        }) else {
            continue;
        };
        let Some(assets) = release["assets"].as_array() else {
            continue;
        };
        for asset in assets.iter().take(128) {
            if asset
                .get("state")
                .is_some_and(|state| state.as_str() != Some("uploaded"))
            {
                continue;
            }
            let Some(number) = asset["name"]
                .as_str()
                .and_then(|name| installer(name, os, arch))
            else {
                continue;
            };
            if best.as_ref().is_none_or(|(previous, _)| number > *previous) {
                best = Some((number, page.to_owned()));
            }
        }
    }
    let Some((number, page)) = best else {
        return Ok(UpdateInfo::unconfigured());
    };
    Ok(UpdateInfo {
        status: if number > installed {
            "available"
        } else {
            "current"
        },
        version: Some(format!("{}.{}.{}", number[0], number[1], number[2])),
        url: Some(page),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn release(tag: &str, files: &[&str]) -> Value {
        json!({"html_url":format!("https://github.com/owner/repo/releases/tag/{tag}"),
            "draft":false,"prerelease":false,"assets":files.iter().map(|name|json!({"name":name,"state":"uploaded"})).collect::<Vec<_>>()})
    }
    #[test]
    fn chooses_newest_compatible_installer_across_desktop_and_plugin_tags() {
        let values = json!([
            release(
                "plugin-v9.0.0",
                &["stashdock-plugin-9.0.0-darwin-arm64.zip"]
            ),
            release("v0.12.0", &["StashDock_0.12.0_x64-setup.exe"]),
            release("desktop-v0.10.0", &["StashDock_0.10.0_aarch64.dmg"]),
            release("v0.9.0", &["StashDock_0.9.0_universal.dmg"]),
            release("v0.11.0", &["StashDock_0.11.0_x64.dmg"])
        ]);
        let mac = select(&values, "owner/repo", "0.2.5", "macos", "aarch64").unwrap();
        assert_eq!(mac.status, "available");
        assert_eq!(mac.version.as_deref(), Some("0.10.0"));
        assert!(mac.url.unwrap().ends_with("/desktop-v0.10.0"));
        assert_eq!(
            select(&values, "owner/repo", "0.2.5", "macos", "x86_64")
                .unwrap()
                .version
                .as_deref(),
            Some("0.11.0")
        );
        assert_eq!(
            select(&values, "owner/repo", "0.2.5", "windows", "x86_64")
                .unwrap()
                .version
                .as_deref(),
            Some("0.12.0")
        );
    }
    #[test]
    fn no_mac_installer_means_no_mac_release_even_if_windows_is_newer() {
        let values = json!([release(
            "v9.0.0",
            &["StashDock_9.0.0_x64-setup.exe", "StashDock_9.0.0_x64.dmg"]
        )]);
        assert_eq!(
            select(&values, "owner/repo", "0.2.5", "macos", "aarch64").unwrap(),
            UpdateInfo::unconfigured()
        );
        assert_eq!(
            select(&values, "owner/repo", "0.2.5", "linux", "x86_64").unwrap(),
            UpdateInfo::unconfigured()
        );
    }
    #[test]
    fn ignores_drafts_prereleases_incomplete_assets_and_foreign_pages() {
        let good = release("v0.2.5", &["StashDock_0.2.5_arm64.dmg"]);
        let mut draft = release("v9.0.0", &["StashDock_9.0.0_arm64.dmg"]);
        draft["draft"] = json!(true);
        let mut preview = draft.clone();
        preview["draft"] = json!(false);
        preview["prerelease"] = json!(true);
        let mut incomplete = draft.clone();
        incomplete["draft"] = json!(false);
        incomplete["assets"][0]["state"] = json!("new");
        let mut foreign = draft.clone();
        foreign["draft"] = json!(false);
        foreign["html_url"] = json!("https://github.com/owner/repo.evil/releases/tag/v9.0.0");
        let values = json!([draft, preview, incomplete, foreign, good]);
        assert_eq!(
            select(&values, "owner/repo", "0.2.5", "macos", "aarch64")
                .unwrap()
                .status,
            "current"
        );
        assert_eq!(
            select(&values, "owner/repo", "0.3.0", "macos", "aarch64")
                .unwrap()
                .status,
            "current"
        );
    }
    #[test]
    fn versions_are_numeric_and_malformed_metadata_is_bounded() {
        assert!(version("0.10.0") > version("0.9.0"));
        for value in ["0.3.0-beta", "0.3", "+0.3.0", "0.3.0.exe", "0.3.0/evil"] {
            assert!(version(value).is_none());
        }
        assert!(select(&json!({}), "owner/repo", "0.2.5", "macos", "aarch64").is_err());
        assert!(select(&json!([]), "owner/repo", "bad", "macos", "aarch64").is_err());
        assert_eq!(
            select(&json!([]), "owner/repo", "0.2.5", "macos", "aarch64").unwrap(),
            UpdateInfo::unconfigured()
        );
    }
}
