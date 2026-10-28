//! Public macOS service adapters. Called by bounded blocking command workers,
//! never by a UI callback waiting for the same worker.
use objc2_app_kit::{NSRunningApplication, NSWorkspace, NSWorkspaceOpenConfiguration};
use objc2_foundation::{NSError, NSOperationQueue, NSString, NSURL};
use objc2_service_management::{SMAppService, SMAppServiceStatus};

pub(crate) fn login_enabled() -> bool {
    // SAFETY: Main-app service has no caller-owned pointers or thread affinity.
    unsafe { SMAppService::mainAppService().status() == SMAppServiceStatus::Enabled }
}
pub(crate) fn login_requires_approval() -> bool {
    unsafe { SMAppService::mainAppService().status() == SMAppServiceStatus::RequiresApproval }
}
pub(crate) fn set_login(enabled: bool) -> Result<(), String> {
    // The system owns registration and consent; no LaunchAgent plist, helper,
    // polling or duplicated preference flag is needed.
    unsafe {
        let service = SMAppService::mainAppService();
        let status = service.status();
        let result = if enabled {
            if status == SMAppServiceStatus::Enabled
                || status == SMAppServiceStatus::RequiresApproval
            {
                Ok(())
            } else {
                service.registerAndReturnError()
            }
        } else if status == SMAppServiceStatus::NotRegistered
            || status == SMAppServiceStatus::NotFound
        {
            Ok(())
        } else {
            service.unregisterAndReturnError()
        };
        if let Err(error) = result {
            // A consent-required registration remains a valid pending request.
            if !enabled || service.status() != SMAppServiceStatus::RequiresApproval {
                eprintln!("StashDock login item: {}", error.localizedDescription());
                return Err("Mac login settings could not be changed. Try again.".into());
            }
        }
        if enabled && service.status() == SMAppServiceStatus::RequiresApproval {
            NSOperationQueue::mainQueue().addOperationWithBlock(&block2::RcBlock::new(|| {
                SMAppService::openSystemSettingsLoginItems();
            }));
        }
        Ok(())
    }
}

/// Accept a recorded desktop executable only when it belongs to the expected
/// application bundle. Launch the bundle through LaunchServices, never its binary.
pub(crate) fn desktop_bundle(path: &str) -> Option<String> {
    use objc2_foundation::NSBundle;
    use std::path::Path;
    let executable = Path::new(path);
    if !executable.is_absolute() || !executable.is_file() {
        return None;
    }
    let root = executable
        .ancestors()
        .find(|p| p.extension().is_some_and(|ext| ext == "app"))?;
    let bundle = NSBundle::bundleWithPath(&NSString::from_str(root.to_str()?))?;
    if bundle.bundleIdentifier()?.to_string() != "app.stashdock.desktop" {
        return None;
    }
    let actual = std::fs::canonicalize(bundle.executablePath()?.to_string()).ok()?;
    (actual == std::fs::canonicalize(executable).ok()?).then(|| root.to_string_lossy().into_owned())
}

/// Older applications must never be launched with an unknown flag: they would
/// open their normal window. Check only this application's bounded bundle plist.
pub(crate) fn supports_safari_status(application: &str) -> bool {
    let path = std::path::Path::new(application).join("Contents/Info.plist");
    if !std::fs::metadata(&path).is_ok_and(|meta| meta.len() <= 1_000_000) {
        return false;
    }
    plist::Value::from_file(path).ok().and_then(|value| {
        value
            .as_dictionary()?
            .get("StashDockSafariStatusProtocol")?
            .as_unsigned_integer()
    }) == Some(1)
}

pub(crate) fn application_path(ids: &[&str]) -> Option<String> {
    let workspace = NSWorkspace::sharedWorkspace();
    ids.iter().find_map(|id| {
        workspace
            .URLForApplicationWithBundleIdentifier(&NSString::from_str(id))?
            .path()
            .map(|p| p.to_string())
    })
}

/// LaunchServices completion means the OS accepted the actual app launch,
/// rather than merely succeeding at spawning an `open` subprocess.
pub(crate) fn open(target: &str) -> Result<(), String> {
    let target = target.to_owned();
    let (send, receive) = std::sync::mpsc::sync_channel(1);
    // SAFETY: the queue copies this owned, Send-only capture; no borrowed UI objects.
    unsafe {
        NSOperationQueue::mainQueue().addOperationWithBlock(&block2::RcBlock::new(move || {
            let url = if std::path::Path::new(&target).is_absolute() {
                Some(NSURL::fileURLWithPath(&NSString::from_str(&target)))
            } else {
                NSURL::URLWithString(&NSString::from_str(&target))
            };
            let Some(url) = url else {
                let _ = send.send(Err("The app could not be opened. Try again.".into()));
                return;
            };
            let reply = send.clone();
            let completion =
                block2::RcBlock::new(move |app: *mut NSRunningApplication, error: *mut NSError| {
                    let result = if error.is_null() && !app.is_null() {
                        Ok(())
                    } else {
                        Err("The app could not be opened. Try again.".into())
                    };
                    let _ = reply.send(result);
                });
            let workspace = NSWorkspace::sharedWorkspace();
            let configuration = NSWorkspaceOpenConfiguration::configuration();
            if std::path::Path::new(&target)
                .extension()
                .is_some_and(|ext| ext == "app")
            {
                workspace.openApplicationAtURL_configuration_completionHandler(
                    &url,
                    &configuration,
                    Some(&completion),
                );
            } else {
                workspace.openURL_configuration_completionHandler(
                    &url,
                    &configuration,
                    Some(&completion),
                );
            }
        }));
    }
    receive
        .recv_timeout(std::time::Duration::from_secs(15))
        .map_err(|_| "The app did not respond in time. Try again.".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn registered_desktop_requires_its_own_bundle_executable() {
        let root = std::env::temp_dir().join(format!("stashdock-bundle-{}", uuid::Uuid::new_v4()));
        let app = root.join("Renamed StashDock.app");
        let bin = app.join("Contents/MacOS/stashdock");
        std::fs::create_dir_all(bin.parent().unwrap()).unwrap();
        let plist = app.join("Contents/Info.plist");
        std::fs::write(&plist, r#"<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>app.stashdock.desktop</string><key>CFBundleExecutable</key><string>stashdock</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>"#).unwrap();
        std::fs::write(&bin, b"fixture executable").unwrap();
        assert_eq!(
            desktop_bundle(bin.to_str().unwrap()),
            Some(app.to_string_lossy().into_owned())
        );
        let other = bin.with_file_name("another");
        std::fs::write(&other, b"other file").unwrap();
        assert!(desktop_bundle(other.to_str().unwrap()).is_none());
        assert!(desktop_bundle("relative.app/Contents/MacOS/stashdock").is_none());
        let external = root.join("stashdock.exe");
        std::fs::write(&external, b"Windows record").unwrap();
        assert!(desktop_bundle(external.to_str().unwrap()).is_none());
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn safari_probe_requires_an_explicit_supported_bundle_protocol() {
        let root = std::env::temp_dir().join(format!("stashdock-probe-{}", uuid::Uuid::new_v4()));
        let contents = root.join("Contents");
        std::fs::create_dir_all(&contents).unwrap();
        let path = contents.join("Info.plist");
        assert!(!supports_safari_status(root.to_str().unwrap()));
        for (value, expected) in [
            ("<dict/>", false),
            (
                "<dict><key>StashDockSafariStatusProtocol</key><string>1</string></dict>",
                false,
            ),
            (
                "<dict><key>StashDockSafariStatusProtocol</key><integer>2</integer></dict>",
                false,
            ),
            (
                "<dict><key>StashDockSafariStatusProtocol</key><integer>1</integer></dict>",
                true,
            ),
        ] {
            std::fs::write(
                &path,
                format!("<?xml version=\"1.0\"?><plist version=\"1.0\">{value}</plist>"),
            )
            .unwrap();
            assert_eq!(supports_safari_status(root.to_str().unwrap()), expected);
        }
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn unknown_application_has_no_launch_services_match() {
        assert!(application_path(&["app.stashdock.test.nonexistent"]).is_none());
    }
}
