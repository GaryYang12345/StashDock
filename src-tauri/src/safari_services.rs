//! SafariServices state belongs to the signed containing application.
//! Shared by its normal Desktop worker and its bounded, windowless status mode.
#[cfg(target_os = "macos")]
#[link(name = "SafariServices", kind = "framework")]
unsafe extern "C" {}

#[cfg(target_os = "macos")]
struct SafariStateReplyEncoding;
// SAFETY: On supported 64-bit macOS targets this is the public SafariServices
// reply block: void (^)(SFSafariExtensionState *, NSError *). NSXPC requires
// the named object types; RcBlock::new deliberately omits signature metadata.
#[cfg(target_os = "macos")]
unsafe impl block2::ManualBlockEncoding for SafariStateReplyEncoding {
    type Arguments = (
        *mut objc2::runtime::AnyObject,
        *mut objc2::runtime::AnyObject,
    );
    type Return = ();
    const ENCODING_CSTR: &'static std::ffi::CStr =
        c"v24@?0@\"SFSafariExtensionState\"8@\"NSError\"16";
}

#[cfg(target_os = "macos")]
pub(crate) fn enabled(id: &str) -> bool {
    use objc2::{class, msg_send, runtime::AnyObject};
    use objc2_foundation::{NSOperationQueue, NSString};
    let (send, receive) = std::sync::mpsc::sync_channel(1);
    let id = id.to_owned();
    let operation = block2::RcBlock::new(move || {
        let failed = send.clone();
        let reply = send.clone();
        let completion = block2::RcBlock::with_encoding::<_, _, _, SafariStateReplyEncoding>(
            move |state: *mut AnyObject, error: *mut AnyObject| {
                // SAFETY: SafariServices supplies a live SFSafariExtensionState for
                // this callback; isEnabled is its public BOOL property.
                if !error.is_null() {
                    // SafariServices owns this live NSError for the callback.
                    // Log only its domain/code, never browsing/profile content.
                    let error = unsafe { &*error.cast::<objc2_foundation::NSError>() };
                    eprintln!(
                        "StashDock Safari state: {} ({})",
                        error.domain(),
                        error.code()
                    );
                }
                let enabled = !state.is_null()
                    && error.is_null()
                    && objc2::exception::catch(std::panic::AssertUnwindSafe(|| unsafe {
                        msg_send![state, isEnabled]
                    }))
                    .unwrap_or(false);
                let _ = reply.send(enabled);
            },
        );
        // SafariServices is a UI actor. Never invoke it on the HTTP/settings
        // worker. A signing/availability exception must fail detection closed,
        // rather than unwind an Objective-C exception through Rust.
        let result = objc2::exception::catch(std::panic::AssertUnwindSafe(|| unsafe {
            let _: () = msg_send![class!(SFSafariExtensionManager), getStateOfSafariExtensionWithIdentifier: &*NSString::from_str(&id), completionHandler: &*completion];
        }));
        if let Err(error) = result {
            eprintln!("StashDock Safari installation check: {error:?}");
            let _ = failed.send(false);
        }
    });
    // SAFETY: The block captures only an owned String and thread-safe senders.
    // NSOperationQueue copies it and runs it on the owning application UI thread.
    unsafe { NSOperationQueue::mainQueue().addOperationWithBlock(&operation) };
    receive
        .recv_timeout(std::time::Duration::from_millis(1500))
        .unwrap_or(false)
}

/// Handle only this fixed read-only mode, before Tauri, single-instance handling,
/// storage, WebKit or window creation. No arbitrary extension ID or path input.
pub fn run_status_command() -> bool {
    if std::env::args_os().skip(1).collect::<Vec<_>>()
        != [std::ffi::OsString::from("--safari-extension-state")]
    {
        return false;
    }
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSApplication, NSApplicationActivationPolicy};
    use objc2_foundation::NSOperationQueue;
    let mtm = MainThreadMarker::new().expect("Native status requires the main thread.");
    let application = NSApplication::sharedApplication(mtm);
    application.setActivationPolicy(NSApplicationActivationPolicy::Prohibited);
    std::thread::spawn(|| {
        let config: serde_json::Value = serde_json::from_str(include_str!("../product-links.json"))
            .expect("Product configuration");
        let detected = config["browserExtensions"]["safari"]["id"]
            .as_str()
            .is_some_and(enabled);
        // Finish normally on AppKit's owning thread. No library/window or
        // persistent process was initialized by this request.
        unsafe {
            NSOperationQueue::mainQueue().addOperationWithBlock(&block2::RcBlock::new(move || {
                println!(
                    "{}",
                    serde_json::json!({"protocolVersion":1,"enabled":detected})
                );
                NSApplication::sharedApplication(MainThreadMarker::new().unwrap()).terminate(None);
            }))
        };
    });
    application.run();
    true
}
