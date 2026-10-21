//! Dedicated STA and private profile for the OS WebView2 renderer. Only this
//! session's browser process enters our bounded job; no daily browser is touched.
use super::BrowserJob;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc,
    },
    thread,
    time::{Duration, Instant},
};
use webview2_com::{
    BasicAuthenticationRequestedEventHandler, CallDevToolsProtocolMethodCompletedHandler,
    CapturePreviewCompletedHandler, ClearBrowsingDataCompletedHandler,
    ClientCertificateRequestedEventHandler, CoTaskMemPWSTR, CoreWebView2EnvironmentOptions,
    CreateCoreWebView2ControllerCompletedHandler, CreateCoreWebView2EnvironmentCompletedHandler,
    DevToolsProtocolEventReceivedEventHandler, DownloadStartingEventHandler,
    LaunchingExternalUriSchemeEventHandler, Microsoft::Web::WebView2::Win32::*,
    NavigationStartingEventHandler, NewWindowRequestedEventHandler,
    PermissionRequestedEventHandler,
};
use windows_webview::{
    core::{w, Interface, PCWSTR, PWSTR},
    Win32::{
        Foundation::{HGLOBAL, HWND, RECT},
        System::Com::{
            CoInitializeEx, CoUninitialize, IStream, StructuredStorage::CreateStreamOnHGlobal,
            COINIT_APARTMENTTHREADED, STREAM_SEEK_END, STREAM_SEEK_SET,
        },
        UI::WindowsAndMessaging::*,
    },
};

pub struct Session {
    commands: mpsc::SyncSender<(u64, String, Value)>,
    events: mpsc::Receiver<Value>,
    stop: Arc<AtomicBool>,
    overflow: Arc<AtomicBool>,
    thread: Option<thread::JoinHandle<()>>,
}
impl Session {
    pub fn start(
        profile: PathBuf,
        proxy: std::net::SocketAddr,
        deadline: Instant,
        expires: Instant,
    ) -> Result<Self, String> {
        let (commands, requests) = mpsc::sync_channel(32);
        let (events, replies) = mpsc::sync_channel(256);
        let (ready, initialized) = mpsc::sync_channel(1);
        let stop = Arc::new(AtomicBool::new(false));
        let overflow = Arc::new(AtomicBool::new(false));
        let shutdown = stop.clone();
        let queue_failed = overflow.clone();
        let worker = thread::spawn(move || {
            if let Err(error) = run(
                profile,
                proxy,
                requests,
                events.clone(),
                ready.clone(),
                &shutdown,
                &queue_failed,
                deadline,
                expires,
            ) {
                let _ = ready.try_send(Err(error.clone()));
                let _ = events.try_send(json!({"sessionError":error}));
            }
        });
        let session = Self {
            commands,
            events: replies,
            stop,
            overflow,
            thread: Some(worker),
        };
        initialized
            .recv_timeout(deadline.saturating_duration_since(Instant::now()))
            .map_err(|_| "The system WebView2 renderer did not initialize.".to_string())??;
        Ok(session)
    }
    pub fn send(&self, id: u64, method: &str, params: Value) -> Result<(), String> {
        send_bounded(
            &self.commands,
            (id, method.to_string(), params),
            &self.stop,
            Duration::from_secs(1),
        )
    }
    pub fn read(&self) -> Result<Option<Value>, String> {
        if self.overflow.load(Ordering::Acquire) {
            return Err("The renderer event limits were exceeded.".into());
        }
        match self.events.recv_timeout(Duration::from_millis(100)) {
            Ok(value) => {
                if let Some(error) = value["sessionError"].as_str() {
                    Err(error.into())
                } else {
                    Ok(Some(value))
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => Ok(None),
            Err(_) => Err("The system renderer stopped.".into()),
        }
    }
}
// Only the capture worker may wait. COM callbacks below remain non-blocking.
fn send_bounded<T>(
    queue: &mpsc::SyncSender<T>,
    mut value: T,
    stop: &AtomicBool,
    budget: Duration,
) -> Result<(), String> {
    let until = Instant::now() + budget;
    loop {
        if stop.load(Ordering::Acquire) {
            return Err("The system renderer stopped.".into());
        }
        match queue.try_send(value) {
            Ok(()) => return Ok(()),
            Err(mpsc::TrySendError::Disconnected(_)) => {
                return Err("The renderer command queue is unavailable.".into())
            }
            Err(mpsc::TrySendError::Full(pending)) => {
                if Instant::now() >= until {
                    return Err("The renderer command queue did not drain in time.".into());
                }
                value = pending;
                thread::sleep(Duration::from_millis(1));
            }
        }
    }
}
fn relevant_event(name: &str, params: &Value) -> bool {
    match name {
        "Network.requestWillBeSent" | "Network.responseReceived" => params["type"] == "Document",
        "Runtime.consoleAPICalled" => {
            std::env::var_os("STASHDOCK_PREVIEW_DIAGNOSTICS").is_some()
                && params["args"][0]["value"]
                    .as_str()
                    .is_some_and(|s| s.starts_with("PDF stage:"))
        }
        _ => true,
    }
}
impl Drop for Session {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(worker) = self.thread.take() {
            let _ = worker.join();
        }
    }
}
fn pump() {
    unsafe {
        let mut message = MSG::default();
        while PeekMessageW(&mut message, None, 0, 0, PM_REMOVE).as_bool() {
            let _ = TranslateMessage(&message);
            DispatchMessageW(&message);
        }
        let _ = MsgWaitForMultipleObjectsEx(None, 10, QS_ALLINPUT, MWMO_INPUTAVAILABLE);
    }
}
fn snapshot_data(stream: &IStream) -> Result<String, String> {
    let mut length = 0;
    unsafe { stream.Seek(0, STREAM_SEEK_END, Some(&mut length)) }.map_err(|e| e.to_string())?;
    if length == 0 || length > 5_000_000 {
        return Err("Screenshot exceeds its size limit.".into());
    }
    unsafe { stream.Seek(0, STREAM_SEEK_SET, None) }.map_err(|e| e.to_string())?;
    let mut bytes = vec![0; length as usize];
    let mut read = 0;
    unsafe { stream.Read(bytes.as_mut_ptr().cast(), length as u32, Some(&mut read)) }
        .ok()
        .map_err(|e| e.to_string())?;
    if u64::from(read) != length {
        return Err("Screenshot stream was incomplete.".into());
    }
    Ok(STANDARD.encode(bytes))
}
fn wait<T>(result: &mpsc::Receiver<T>, stop: &AtomicBool, deadline: Instant) -> Result<T, String> {
    loop {
        if stop.load(Ordering::Acquire) || Instant::now() >= deadline {
            return Err("The system renderer timed out.".into());
        }
        if let Ok(value) = result.try_recv() {
            return Ok(value);
        }
        pump();
    }
}
struct Com;
impl Drop for Com {
    fn drop(&mut self) {
        unsafe {
            CoUninitialize();
        }
    }
}
struct Window(HWND);
impl Drop for Window {
    fn drop(&mut self) {
        unsafe {
            let _ = DestroyWindow(self.0);
        }
    }
}
struct Controller(ICoreWebView2Controller);
impl Drop for Controller {
    fn drop(&mut self) {
        unsafe {
            let _ = self.0.Close();
        }
    }
}
fn run(
    profile: PathBuf,
    proxy: std::net::SocketAddr,
    requests: mpsc::Receiver<(u64, String, Value)>,
    events: mpsc::SyncSender<Value>,
    ready: mpsc::SyncSender<Result<(), String>>,
    stop: &Arc<AtomicBool>,
    overflow: &Arc<AtomicBool>,
    deadline: Instant,
    expires: Instant,
) -> Result<(), String> {
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED)
            .ok()
            .map_err(|e| e.to_string())?;
    }
    let _com = Com;
    // Never shown or activated. CDP captures the renderer surface directly.
    let parent = Window(
        unsafe {
            CreateWindowExW(
                WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
                w!("STATIC"),
                w!("StashDock isolated renderer"),
                WS_POPUP,
                0,
                0,
                1280,
                800,
                None,
                None,
                None,
                None,
            )
        }
        .map_err(|e| e.to_string())?,
    );
    let options = CoreWebView2EnvironmentOptions::default();
    unsafe {
        options.set_additional_browser_arguments(format!("--hide-scrollbars --disable-background-networking --disable-component-update --disable-sync --disable-extensions --disable-quic --disable-features=MediaRouter --force-webrtc-ip-handling-policy=disable_non_proxied_udp --proxy-bypass-list=<-loopback> --proxy-server=http://{proxy}"));
        options.set_exclusive_user_data_folder_access(true);
    }
    let options: ICoreWebView2EnvironmentOptions = options.into();
    let (send, environment) = mpsc::channel();
    let handler =
        CreateCoreWebView2EnvironmentCompletedHandler::create(Box::new(move |code, value| {
            let result = code.map_err(|e| e.to_string()).and_then(|_| {
                value.ok_or_else(|| {
                    "WebView2 Runtime is unavailable. Install Microsoft Edge WebView2 Runtime."
                        .into()
                })
            });
            let _ = send.send(result);
            Ok(())
        }));
    let folder = CoTaskMemPWSTR::from(profile.to_string_lossy().as_ref());
    unsafe {
        CreateCoreWebView2EnvironmentWithOptions(
            PCWSTR::null(),
            *folder.as_ref().as_pcwstr(),
            &options,
            &handler,
        )
        .map_err(|_| {
            "WebView2 Runtime is unavailable. Install Microsoft Edge WebView2 Runtime.".to_string()
        })?;
    }
    let environment = wait(&environment, stop, deadline)??;
    let (send, controller) = mpsc::channel();
    let handler =
        CreateCoreWebView2ControllerCompletedHandler::create(Box::new(move |code, value| {
            let _ =
                send.send(code.map_err(|e| e.to_string()).and_then(|_| {
                    value.ok_or_else(|| "Renderer controller is unavailable.".into())
                }));
            Ok(())
        }));
    unsafe {
        environment
            .CreateCoreWebView2Controller(parent.0, &handler)
            .map_err(|e| e.to_string())?;
    }
    let controller = Controller(wait(&controller, stop, deadline)??);
    let webview = unsafe {
        controller
            .0
            .SetBounds(RECT {
                left: 0,
                top: 0,
                right: 1280,
                bottom: 800,
            })
            .map_err(|e| e.to_string())?;
        controller.0.SetIsVisible(true).map_err(|e| e.to_string())?;
        controller.0.CoreWebView2().map_err(|e| e.to_string())?
    };
    let _job = unsafe {
        use windows_sys::Win32::{
            Foundation::CloseHandle,
            System::Threading::{
                OpenProcess, SetPriorityClass, BELOW_NORMAL_PRIORITY_CLASS,
                PROCESS_SET_INFORMATION, PROCESS_SET_QUOTA, PROCESS_TERMINATE,
            },
        };
        let mut pid = 0;
        webview
            .BrowserProcessId(&mut pid)
            .map_err(|e| e.to_string())?;
        let process = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid);
        if process.is_null() {
            return Err("The isolated renderer could not be bounded.".into());
        }
        let result = BrowserJob::assign(process, 768 * 1024 * 1024);
        CloseHandle(process);
        let job = result?;
        // Early children may already be in Chromium's sandbox jobs and cannot
        // be reassigned. Lower scheduling priority where permitted instead;
        // never weaken the sandbox or fail a screenshot for this optimization.
        // This API reports only our exclusive temporary-profile environment.
        let own_environment: ICoreWebView2Environment8 =
            environment.cast().map_err(|e| e.to_string())?;
        let processes = own_environment
            .GetProcessInfos()
            .map_err(|e| e.to_string())?;
        let mut count = 0;
        processes.Count(&mut count).map_err(|e| e.to_string())?;
        for index in 0..count {
            let info = processes
                .GetValueAtIndex(index)
                .map_err(|e| e.to_string())?;
            let mut child_pid = 0;
            info.ProcessId(&mut child_pid).map_err(|e| e.to_string())?;
            if child_pid <= 0 || child_pid as u32 == pid {
                continue;
            }
            let process = OpenProcess(PROCESS_SET_INFORMATION, 0, child_pid as u32);
            if process.is_null() {
                continue;
            }
            let _ = SetPriorityClass(process, BELOW_NORMAL_PRIORITY_CLASS);
            CloseHandle(process);
        }
        job
    };
    unsafe {
        let settings = webview.Settings().map_err(|e| e.to_string())?;
        settings
            .SetAreDevToolsEnabled(false)
            .map_err(|e| e.to_string())?;
        settings
            .SetAreDefaultScriptDialogsEnabled(false)
            .map_err(|e| e.to_string())?;
        settings
            .SetAreDefaultContextMenusEnabled(false)
            .map_err(|e| e.to_string())?;
        settings
            .SetIsWebMessageEnabled(false)
            .map_err(|e| e.to_string())?;
        settings
            .SetAreHostObjectsAllowed(false)
            .map_err(|e| e.to_string())?;
        let settings4: ICoreWebView2Settings4 = settings.cast().map_err(|e| e.to_string())?;
        settings4
            .SetIsPasswordAutosaveEnabled(false)
            .map_err(|e| e.to_string())?;
        settings4
            .SetIsGeneralAutofillEnabled(false)
            .map_err(|e| e.to_string())?;
        let mut token = 0;
        let navigation = NavigationStartingEventHandler::create(Box::new(|_, args| {
            if let Some(args) = args {
                let mut uri = PWSTR::null();
                args.Uri(&mut uri)?;
                let uri = CoTaskMemPWSTR::from(uri).to_string();
                if !allowed_navigation(&uri) {
                    args.SetCancel(true)?;
                }
            }
            Ok(())
        }));
        webview
            .add_NavigationStarting(&navigation, &mut token)
            .map_err(|e| e.to_string())?;
        webview
            .add_FrameNavigationStarting(&navigation, &mut token)
            .map_err(|e| e.to_string())?;
        // Background capture must never prompt for credentials/certificates or
        // hand a website's URI to an application on the user's machine.
        let authentication: ICoreWebView2_10 = webview
            .cast()
            .map_err(|_| "Update Microsoft Edge WebView2 Runtime to capture webpages.")?;
        authentication
            .add_BasicAuthenticationRequested(
                &BasicAuthenticationRequestedEventHandler::create(Box::new(|_, args| {
                    if let Some(args) = args {
                        args.SetCancel(true)?;
                    }
                    Ok(())
                })),
                &mut token,
            )
            .map_err(|e| e.to_string())?;
        let certificates: ICoreWebView2_5 = webview.cast().map_err(|e| e.to_string())?;
        certificates
            .add_ClientCertificateRequested(
                &ClientCertificateRequestedEventHandler::create(Box::new(|_, args| {
                    if let Some(args) = args {
                        args.SetCancel(true)?;
                        args.SetHandled(true)?;
                    }
                    Ok(())
                })),
                &mut token,
            )
            .map_err(|e| e.to_string())?;
        let protocols: ICoreWebView2_18 = webview
            .cast()
            .map_err(|_| "Update Microsoft Edge WebView2 Runtime to capture webpages.")?;
        protocols
            .add_LaunchingExternalUriScheme(
                &LaunchingExternalUriSchemeEventHandler::create(Box::new(|_, args| {
                    if let Some(args) = args {
                        args.SetCancel(true)?;
                    }
                    Ok(())
                })),
                &mut token,
            )
            .map_err(|e| e.to_string())?;
        webview
            .add_NewWindowRequested(
                &NewWindowRequestedEventHandler::create(Box::new(|_, args| {
                    if let Some(args) = args {
                        args.SetHandled(true)?;
                    }
                    Ok(())
                })),
                &mut token,
            )
            .map_err(|e| e.to_string())?;
        webview
            .add_PermissionRequested(
                &PermissionRequestedEventHandler::create(Box::new(|_, args| {
                    if let Some(args) = args {
                        args.SetState(COREWEBVIEW2_PERMISSION_STATE_DENY)?;
                    }
                    Ok(())
                })),
                &mut token,
            )
            .map_err(|e| e.to_string())?;
        let downloads: ICoreWebView2_4 = webview.cast().map_err(|e| e.to_string())?;
        downloads
            .add_DownloadStarting(
                &DownloadStartingEventHandler::create(Box::new(|_, args| {
                    if let Some(args) = args {
                        args.SetCancel(true)?;
                    }
                    Ok(())
                })),
                &mut token,
            )
            .map_err(|e| e.to_string())?;
    }
    // Event sources are COM objects too; keep them alive for the whole session.
    let mut receivers = Vec::new();
    for name in [
        "Fetch.requestPaused",
        "Network.requestWillBeSent",
        "Network.responseReceived",
        "Network.loadingFailed",
        "Page.loadEventFired",
        "Runtime.consoleAPICalled",
    ] {
        let method = CoTaskMemPWSTR::from(name);
        let receiver =
            unsafe { webview.GetDevToolsProtocolEventReceiver(*method.as_ref().as_pcwstr()) }
                .map_err(|e| e.to_string())?;
        let output = events.clone();
        let failed = overflow.clone();
        let shutdown = stop.clone();
        let handler =
            DevToolsProtocolEventReceivedEventHandler::create(Box::new(move |_, args| {
                if let Some(args) = args {
                    let mut data = PWSTR::null();
                    unsafe {
                        args.ParameterObjectAsJson(&mut data)?;
                    }
                    let data = CoTaskMemPWSTR::from(data);
                    let data = data.to_string();
                    if data.len() > 128 * 1024 {
                        failed.store(true, Ordering::Release);
                        shutdown.store(true, Ordering::Release);
                        return Ok(());
                    }
                    if let Ok(params) = serde_json::from_str::<Value>(&data) {
                        if !relevant_event(name, &params) {
                            return Ok(());
                        }
                        publish(
                            &output,
                            json!({"method":name,"params":params}),
                            &failed,
                            &shutdown,
                        );
                    }
                }
                Ok(())
            }));
        unsafe {
            let mut token = 0;
            receiver
                .add_DevToolsProtocolEventReceived(&handler, &mut token)
                .map_err(|e| e.to_string())?;
        }
        receivers.push(receiver);
    }
    let _ = ready.send(Ok(()));
    while !stop.load(Ordering::Acquire) && Instant::now() < expires {
        // Return to the STA message pump even under a continuous request burst.
        for (id, method, params) in requests.try_iter().take(8) {
            if method == "StashDock.captureViewport" {
                // Use WebView2's own viewport API, not Chromium's DevTools
                // compositor screenshot path. Keep the existing wire response
                // and post-processing limits; never stop page loads to capture.
                let stream = unsafe { CreateStreamOnHGlobal(HGLOBAL::default(), true) }
                    .map_err(|e| e.to_string())?;
                let snapshot = stream.clone();
                let output = events.clone();
                let failed = overflow.clone();
                let shutdown = stop.clone();
                let handler = CapturePreviewCompletedHandler::create(Box::new(move |code| {
                    let result = code
                        .map_err(|e| e.to_string())
                        .and_then(|_| snapshot_data(&snapshot));
                    let response = match result {
                        Ok(data) => json!({"id":id,"result":{"data":data}}),
                        Err(error) => json!({"id":id,"error":{"message":error}}),
                    };
                    publish(&output, response, &failed, &shutdown);
                    Ok(())
                }));
                if let Err(error) = unsafe {
                    webview.CapturePreview(
                        COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_JPEG,
                        &stream,
                        &handler,
                    )
                } {
                    publish(
                        &events,
                        json!({"id":id,"error":{"message":error.to_string()}}),
                        &overflow,
                        &stop,
                    );
                }
                continue;
            }
            if method == "StashDock.resetProfile" {
                let output = events.clone();
                let failed = overflow.clone();
                let shutdown = stop.clone();
                let handler = ClearBrowsingDataCompletedHandler::create(Box::new(move |code| {
                    let value = if code.is_ok() {
                        json!({"id":id,"result":{}})
                    } else {
                        json!({"id":id,"error":{"message":"The isolated capture profile could not be reset."}})
                    };
                    publish(&output, value, &failed, &shutdown);
                    Ok(())
                }));
                unsafe {
                    let view: ICoreWebView2_13 = webview.cast().map_err(|e| e.to_string())?;
                    let profile: ICoreWebView2Profile2 = view
                        .Profile()
                        .map_err(|e| e.to_string())?
                        .cast()
                        .map_err(|e| e.to_string())?;
                    profile
                        .ClearBrowsingDataAll(&handler)
                        .map_err(|e| e.to_string())?;
                }
                continue;
            }
            let fire_and_forget = matches!(
                method.as_str(),
                "Fetch.continueRequest" | "Fetch.failRequest"
            );
            let method = CoTaskMemPWSTR::from(method.as_str());
            let params = CoTaskMemPWSTR::from(params.to_string().as_str());
            let output = events.clone();
            let failed = overflow.clone();
            let shutdown = stop.clone();
            let handler = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                move |code, data| {
                    if fire_and_forget {
                        // Navigation / stopLoading can cancel a paused request
                        // before this callback runs. Its continuation failure
                        // is not failure of the WebView session. Main-document
                        // network events, command replies and the deadline still
                        // decide the task outcome; no failed request is allowed
                        // to bypass the pinned public proxy.
                        return Ok(());
                    }
                    let response = if data.len() > 8 * 1024 * 1024 {
                        json!({"id":id,"error":{"message":"Renderer response exceeds its size limit."}})
                    } else if code.is_ok() {
                        match serde_json::from_str::<Value>(&data) {
                            Ok(result) => json!({"id":id,"result":result}),
                            Err(_) => {
                                json!({"id":id,"error":{"message":"Invalid renderer response."}})
                            }
                        }
                    } else {
                        json!({"id":id,"error":{"message":format!("Renderer command failed: {code:?}")}})
                    };
                    publish(&output, response, &failed, &shutdown);
                    Ok(())
                },
            ));
            unsafe {
                webview
                    .CallDevToolsProtocolMethod(
                        *method.as_ref().as_pcwstr(),
                        *params.as_ref().as_pcwstr(),
                        &handler,
                    )
                    .map_err(|e| e.to_string())?;
            }
        }
        pump();
    }
    drop(controller);
    Ok(())
}

// COM callbacks must never block. An overfull bounded queue invalidates the
// session explicitly instead of silently dropping network or command events.
fn publish(
    output: &mpsc::SyncSender<Value>,
    value: Value,
    overflow: &AtomicBool,
    stop: &AtomicBool,
) {
    if output.try_send(value).is_err() {
        overflow.store(true, Ordering::Release);
        stop.store(true, Ordering::Release);
    }
}

fn allowed_navigation(uri: &str) -> bool {
    if matches!(uri, "about:blank" | "about:srcdoc") {
        return true;
    }
    let Ok(url) = crate::public_web::web_url(uri) else {
        return false;
    };
    let host = url.host_str().unwrap_or("").trim_matches(['[', ']']);
    // Never resolve DNS on the COM/UI thread. The proxy pins/checks domain
    // addresses before connecting; literal private IPs can be refused here.
    match host.parse::<std::net::IpAddr>() {
        Ok(ip) => crate::public_web::public_ip(ip),
        Err(_) => host.contains('.'),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_snapshot_stream_is_complete_and_bounded() {
        thread::spawn(|| unsafe {
            CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().unwrap();
            let stream = CreateStreamOnHGlobal(HGLOBAL::default(), true).unwrap();
            assert!(snapshot_data(&stream).is_err());
            let bytes = b"bounded snapshot bytes";
            let mut written = 0;
            stream
                .Write(
                    bytes.as_ptr().cast(),
                    bytes.len() as u32,
                    Some(&mut written),
                )
                .ok()
                .unwrap();
            assert_eq!(written as usize, bytes.len());
            assert_eq!(snapshot_data(&stream).unwrap(), STANDARD.encode(bytes));
            stream.SetSize(5_000_001).unwrap();
            assert!(snapshot_data(&stream).is_err());
            drop(stream);
            CoUninitialize();
        })
        .join()
        .unwrap();
    }

    #[test]
    fn navigation_never_opens_local_documents_or_external_applications() {
        for uri in ["about:blank", "about:srcdoc", "https://example.org/"] {
            assert!(allowed_navigation(uri));
        }
        for uri in [
            "file:///C:/Windows/win.ini",
            "mailto:test@example.org",
            "ms-calculator:",
            "data:text/html,private",
            "http://127.0.0.1/",
            "http://192.168.1.1/",
        ] {
            assert!(!allowed_navigation(uri));
        }
    }

    #[test]
    fn full_event_queue_fails_without_blocking() {
        let (send, _read) = mpsc::sync_channel(1);
        let overflow = AtomicBool::new(false);
        let stop = AtomicBool::new(false);
        publish(&send, json!({"id":1}), &overflow, &stop);
        assert!(!stop.load(Ordering::Acquire));
        publish(&send, json!({"id":2}), &overflow, &stop);
        assert!(overflow.load(Ordering::Acquire));
        assert!(stop.load(Ordering::Acquire));
    }
    #[test]
    fn temporary_command_pressure_waits_but_keeps_its_deadline_and_original_message() {
        let (send, read) = mpsc::sync_channel(1);
        send.send(1).unwrap();
        let reader = thread::spawn(move || {
            thread::sleep(Duration::from_millis(15));
            assert_eq!(read.recv().unwrap(), 1);
            assert_eq!(read.recv().unwrap(), 2);
        });
        send_bounded(&send, 2, &AtomicBool::new(false), Duration::from_secs(1)).unwrap();
        reader.join().unwrap();
        let (send, read) = mpsc::sync_channel(1);
        send.send(3).unwrap();
        assert!(
            send_bounded(&send, 4, &AtomicBool::new(false), Duration::from_millis(5))
                .unwrap_err()
                .contains("drain")
        );
        assert_eq!(read.recv().unwrap(), 3);
        assert!(send_bounded(&send, 5, &AtomicBool::new(true), Duration::from_secs(1)).is_err());
        drop(read);
        assert!(send_bounded(&send, 6, &AtomicBool::new(false), Duration::from_secs(1)).is_err());
    }
    #[test]
    fn resource_noise_is_filtered_but_navigation_and_interception_are_preserved() {
        assert!(!relevant_event(
            "Network.responseReceived",
            &json!({"type":"Image"})
        ));
        assert!(!relevant_event(
            "Network.requestWillBeSent",
            &json!({"type":"Font"})
        ));
        assert!(relevant_event(
            "Network.responseReceived",
            &json!({"type":"Document"})
        ));
        assert!(relevant_event(
            "Fetch.requestPaused",
            &json!({"resourceType":"Image"})
        ));
        assert!(relevant_event(
            "Network.loadingFailed",
            &json!({"requestId":"main"})
        ));
        assert!(!relevant_event(
            "Runtime.consoleAPICalled",
            &json!({"args":[{"value":"Unrelated page log"}]})
        ));
    }
}
