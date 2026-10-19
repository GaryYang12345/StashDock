//! Dedicated STA and private profile for the OS WebView2 renderer. Only this
//! session's browser process enters our bounded job; no daily browser is touched.
use super::BrowserJob;
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
        Foundation::{HWND, RECT},
        System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED},
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
        self.commands
            .try_send((id, method.to_string(), params))
            .map_err(|_| "The renderer command queue is unavailable.".into())
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
            System::Threading::{OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE},
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
        result?
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
    while !stop.load(Ordering::Acquire) && Instant::now() < deadline {
        for (id, method, params) in requests.try_iter() {
            let method = CoTaskMemPWSTR::from(method.as_str());
            let params = CoTaskMemPWSTR::from(params.to_string().as_str());
            let output = events.clone();
            let failed = overflow.clone();
            let shutdown = stop.clone();
            let handler = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                move |code, data| {
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
}
