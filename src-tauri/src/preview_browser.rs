//! Isolated OS WebView2 capture. The public-only proxy covers redirects,
//! subresources and workers; no DIRECT fallback, loopback bypass or UDP WebRTC.
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use std::{
    fs,
    io::{Read, Write},
    net::{Shutdown, TcpListener, TcpStream},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};

const SESSION_BYTES: usize = 24 * 1024 * 1024;
// Only the OS user's enabled configuration may nominate an upstream proxy.
// Page URLs cannot choose it. All actual destinations remain public and pinned.
fn proxy_address(value: &str) -> Option<std::net::SocketAddr> {
    let value = value
        .split(';')
        .find_map(|entry| entry.strip_prefix("https="))
        .or_else(|| {
            value
                .split(';')
                .find_map(|entry| entry.strip_prefix("http="))
        })
        .unwrap_or(value)
        .trim();
    let url = url::Url::parse(&format!(
        "http://{}",
        value.strip_prefix("http://").unwrap_or(value)
    ))
    .ok()?;
    if url.username() != ""
        || url.password().is_some()
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return None;
    }
    let host = url.host_str()?.trim_matches(['[', ']']);
    let ip = if host == "localhost" {
        "127.0.0.1".parse().ok()?
    } else {
        host.parse::<std::net::IpAddr>().ok()?
    };
    let port = value.rsplit_once(':')?.1.parse::<u16>().ok()?;
    (port > 0).then_some(std::net::SocketAddr::new(ip, port))
}
fn system_proxy() -> Option<std::net::SocketAddr> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::System::Registry::{
            RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD, RRF_RT_REG_SZ,
        };
        let wide = |text: &str| text.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
        let key = wide("Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings");
        let mut enabled = 0u32;
        let mut bytes = 4u32;
        if unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                key.as_ptr(),
                wide("ProxyEnable").as_ptr(),
                RRF_RT_REG_DWORD,
                std::ptr::null_mut(),
                (&mut enabled as *mut u32).cast(),
                &mut bytes,
            )
        } != 0
            || enabled != 1
        {
            return None;
        }
        let mut buffer = [0u16; 2048];
        let mut bytes = (buffer.len() * 2) as u32;
        if unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                key.as_ptr(),
                wide("ProxyServer").as_ptr(),
                RRF_RT_REG_SZ,
                std::ptr::null_mut(),
                buffer.as_mut_ptr().cast(),
                &mut bytes,
            )
        } != 0
        {
            return None;
        }
        let length = buffer.iter().position(|v| *v == 0)?;
        proxy_address(&String::from_utf16(&buffer[..length]).ok()?)
    }
    #[cfg(not(windows))]
    {
        None
    }
}
fn connect_upstream(
    proxy: std::net::SocketAddr,
    target: std::net::SocketAddr,
    timeout: Duration,
) -> Result<TcpStream, String> {
    let until = Instant::now() + timeout;
    let mut stream =
        TcpStream::connect_timeout(&proxy, timeout).map_err(|_| "System proxy unavailable.")?;
    stream
        .set_read_timeout(Some(timeout))
        .map_err(|e| e.to_string())?;
    stream
        .set_write_timeout(Some(timeout))
        .map_err(|e| e.to_string())?;
    stream
        .write_all(
            format!(
                "CONNECT {target} HTTP/1.1\r\nHost: {target}\r\nConnection: keep-alive\r\n\r\n"
            )
            .as_bytes(),
        )
        .map_err(|_| "System proxy unavailable.")?;
    let mut response = Vec::new();
    while response.len() < 16384 && !response.ends_with(b"\r\n\r\n") {
        if Instant::now() >= until {
            return Err("System proxy timed out.".into());
        }
        let mut byte = [0];
        if stream
            .read(&mut byte)
            .map_err(|_| "System proxy unavailable.")?
            == 0
        {
            return Err("System proxy closed the connection.".into());
        }
        response.push(byte[0]);
    }
    if !response.ends_with(b"\r\n\r\n")
        || !String::from_utf8_lossy(&response)
            .lines()
            .next()
            .is_some_and(|line| matches!(line.split_whitespace().nth(1), Some("200")))
    {
        return Err("System proxy declined the connection.".into());
    }
    Ok(stream)
}
fn proxy_target(method: &str, target: &str) -> Result<(String, u16, Option<url::Url>), String> {
    let url = if method == "CONNECT" {
        crate::public_web::web_url(&format!("https://{target}/"))?
    } else if matches!(method, "GET" | "HEAD") {
        crate::public_web::web_url(target)?
    } else {
        return Err("Unsupported proxy method.".into());
    };
    if method != "CONNECT" && url.scheme() != "http" {
        return Err("HTTPS requires a tunnel.".into());
    }
    Ok((
        url.host_str().unwrap().trim_matches(['[', ']']).into(),
        url.port_or_known_default().unwrap(),
        (method != "CONNECT").then_some(url),
    ))
}
fn relay(
    mut from: TcpStream,
    mut to: TcpStream,
    stop: Arc<AtomicBool>,
    bytes: Arc<AtomicUsize>,
    deadline: Instant,
    byte_limit: usize,
) {
    let _ = from.set_read_timeout(Some(Duration::from_millis(200)));
    let _ = to.set_write_timeout(Some(Duration::from_millis(500)));
    let mut buffer = [0; 16384];
    while !stop.load(Ordering::Relaxed) && Instant::now() < deadline {
        match from.read(&mut buffer) {
            Ok(0) => break,
            Ok(n) => {
                if bytes.fetch_add(n, Ordering::Relaxed) + n > byte_limit
                    || to.write_all(&buffer[..n]).is_err()
                {
                    break;
                }
            }
            Err(e)
                if matches!(
                    e.kind(),
                    std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock
                ) => {}
            Err(_) => break,
        }
    }
    let _ = to.shutdown(Shutdown::Write);
}
fn proxy_connection(
    mut browser: TcpStream,
    stop: Arc<AtomicBool>,
    bytes: Arc<AtomicUsize>,
    deadline: Instant,
    byte_limit: usize,
    system_upstream: Option<std::net::SocketAddr>,
) -> Result<(), String> {
    browser
        .set_read_timeout(Some(Duration::from_secs(2)))
        .map_err(|e| e.to_string())?;
    let mut header = Vec::new();
    while header.len() < 16384 && !header.ends_with(b"\r\n\r\n") {
        let mut byte = [0];
        if browser.read(&mut byte).map_err(|e| e.to_string())? == 0 {
            return Err("Closed proxy request.".into());
        }
        header.push(byte[0]);
    }
    if !header.ends_with(b"\r\n\r\n") {
        return Err("Proxy header is too large.".into());
    }
    let header = std::str::from_utf8(&header).map_err(|_| "Invalid proxy request.")?;
    let mut first = header.lines().next().unwrap_or("").split_whitespace();
    let method = first.next().ok_or("Missing method.")?;
    let target = first.next().ok_or("Missing target.")?;
    let (host, port, url) = proxy_target(method, target)?;
    // Connect to these exact addresses, never resolve again in connect().
    let addresses = crate::public_web::resolve_public(&host, port)?;
    if stop.load(Ordering::Relaxed) || Instant::now() >= deadline {
        return Err("Capture ended.".into());
    }
    let mut upstream = addresses
        .iter()
        .take(8)
        .find_map(|address| {
            let timeout = deadline
                .saturating_duration_since(Instant::now())
                .min(Duration::from_secs(2));
            if stop.load(Ordering::Relaxed) || timeout.is_zero() {
                return None;
            }
            if let Some(proxy) = system_upstream {
                connect_upstream(proxy, *address, timeout).ok()
            } else {
                TcpStream::connect_timeout(address, timeout).ok()
            }
        })
        .ok_or("Website unavailable.")?;
    if let Some(url) = url {
        let mut path = url.path().to_string();
        if let Some(query) = url.query() {
            path.push('?');
            path.push_str(query);
        }
        let mut request = format!(
            "{method} {path} HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n",
            url.authority()
        );
        for line in header.lines().skip(1).filter(|line| !line.is_empty()) {
            let name = line.split(':').next().unwrap_or("").to_ascii_lowercase();
            if matches!(
                name.as_str(),
                "host"
                    | "connection"
                    | "proxy-connection"
                    | "proxy-authorization"
                    | "content-length"
                    | "transfer-encoding"
            ) {
                continue;
            }
            request.push_str(line);
            request.push_str("\r\n");
        }
        request.push_str("\r\n");
        upstream
            .write_all(request.as_bytes())
            .map_err(|e| e.to_string())?;
    } else {
        browser
            .write_all(b"HTTP/1.1 200 Connection established\r\n\r\n")
            .map_err(|e| e.to_string())?;
    }
    let from = browser.try_clone().map_err(|e| e.to_string())?;
    let to = upstream.try_clone().map_err(|e| e.to_string())?;
    let other_stop = stop.clone();
    let other_bytes = bytes.clone();
    let outgoing =
        thread::spawn(move || relay(from, to, other_stop, other_bytes, deadline, byte_limit));
    relay(upstream, browser, stop, bytes, deadline, byte_limit);
    let _ = outgoing.join();
    Ok(())
}
pub(crate) struct PublicProxy {
    pub(crate) address: std::net::SocketAddr,
    stop: Arc<AtomicBool>,
    listener: Option<thread::JoinHandle<()>>,
}
impl PublicProxy {
    pub(crate) fn start(deadline: Instant) -> Result<Self, String> {
        Self::start_bounded(deadline, SESSION_BYTES)
    }
    pub(crate) fn start_bounded(deadline: Instant, byte_limit: usize) -> Result<Self, String> {
        let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
        listener.set_nonblocking(true).map_err(|e| e.to_string())?;
        let address = listener.local_addr().map_err(|e| e.to_string())?;
        let stop = Arc::new(AtomicBool::new(false));
        let done = stop.clone();
        let count = Arc::new(AtomicUsize::new(0));
        let bytes = Arc::new(AtomicUsize::new(0));
        let task = thread::spawn(move || {
            while !done.load(Ordering::Relaxed) && Instant::now() < deadline {
                if let Ok((stream, _)) = listener.accept() {
                    // VPN/system proxy can change while a sign-in window is open.
                    let system_upstream = system_proxy();
                    if count.load(Ordering::Relaxed) >= 24
                        || bytes.load(Ordering::Relaxed) >= byte_limit
                    {
                        continue;
                    }
                    count.fetch_add(1, Ordering::Relaxed);
                    let stop = done.clone();
                    let bytes = bytes.clone();
                    let count = count.clone();
                    thread::spawn(move || {
                        if let Ok(mut error_stream) = stream.try_clone() {
                            if proxy_connection(
                                stream,
                                stop,
                                bytes,
                                deadline,
                                byte_limit,
                                system_upstream,
                            )
                            .is_err()
                            {
                                let _ = error_stream.write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                            }
                        }
                        count.fetch_sub(1, Ordering::Relaxed);
                    });
                } else {
                    thread::sleep(Duration::from_millis(20));
                }
            }
        });
        Ok(Self {
            address,
            stop,
            listener: Some(task),
        })
    }
}
impl Drop for PublicProxy {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(task) = self.listener.take() {
            let _ = task.join();
        }
    }
}

pub fn runtime_version() -> Option<String> {
    #[cfg(windows)]
    {
        Some("system-webview2:capture-v1".into())
    }
    #[cfg(not(windows))]
    {
        None
    }
}
struct TempProfile(PathBuf);
impl Drop for TempProfile {
    fn drop(&mut self) {
        // Job termination is asynchronous; allow child file handles to close first.
        for _ in 0..40 {
            if fs::remove_dir_all(&self.0).is_ok() || !self.0.exists() {
                break;
            }
            thread::sleep(Duration::from_millis(50));
        }
        if self.0.exists() {
            let path = self.0.clone();
            thread::spawn(move || {
                for _ in 0..40 {
                    if fs::remove_dir_all(&path).is_ok() || !path.exists() {
                        break;
                    }
                    thread::sleep(Duration::from_millis(250));
                }
            });
        }
    }
}
// Kill-on-close Job Object covers renderer children even if StashDock crashes.
#[cfg(windows)]
struct BrowserJob(windows_sys::Win32::Foundation::HANDLE);
#[cfg(windows)]
impl BrowserJob {
    fn assign(
        process: windows_sys::Win32::Foundation::HANDLE,
        memory_limit: usize,
    ) -> Result<Self, String> {
        use windows_sys::Win32::{Foundation::CloseHandle, System::JobObjects::*};
        unsafe {
            let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if handle.is_null() {
                return Err("Capture isolation is unavailable.".into());
            }
            let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            limits.BasicLimitInformation.LimitFlags =
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_JOB_MEMORY;
            limits.JobMemoryLimit = memory_limit;
            if SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                (&limits as *const _) as _,
                std::mem::size_of_val(&limits) as u32,
            ) == 0
                || AssignProcessToJobObject(handle, process) == 0
            {
                CloseHandle(handle);
                return Err("Capture isolation is unavailable.".into());
            }
            Ok(Self(handle))
        }
    }
}
#[cfg(windows)]
impl Drop for BrowserJob {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.0);
        }
    }
}

#[cfg(windows)]
#[path = "preview_webview.rs"]
mod system_webview;
struct Cdp {
    #[cfg(windows)]
    session: system_webview::Session,
    id: u64,
}
impl Cdp {
    fn send(&mut self, method: &str, params: Value) -> Result<u64, String> {
        self.id += 1;
        #[cfg(windows)]
        self.session.send(self.id, method, params)?;
        #[cfg(not(windows))]
        {
            let _ = (method, params);
            return Err("The system renderer is not supported on this platform yet.".into());
        }
        Ok(self.id)
    }
    fn read(&mut self) -> Result<Option<Value>, String> {
        #[cfg(windows)]
        {
            self.session.read()
        }
        #[cfg(not(windows))]
        {
            Err("The system renderer is not supported on this platform yet.".into())
        }
    }
    fn paused(&mut self, event: &Value) -> Result<(), String> {
        if event["method"] == "Fetch.requestPaused" {
            let params = &event["params"];
            let raw = params["request"]["url"].as_str().unwrap_or("");
            if crate::public_web::web_url(raw).is_ok() {
                self.send(
                    "Fetch.continueRequest",
                    json!({"requestId":params["requestId"]}),
                )?;
            } else {
                self.send(
                    "Fetch.failRequest",
                    json!({"requestId":params["requestId"],"errorReason":"BlockedByClient"}),
                )?;
            }
        }
        Ok(())
    }
}
fn capture_page(
    cdp: &mut Cdp,
    url: &str,
    deadline: Instant,
    stop: &AtomicBool,
) -> Result<String, String> {
    cdp.send("Page.enable", json!({}))?;
    // Session creation installs WebView2's native DownloadStarting cancellation
    // before any page runs. Chromium's download CDP method is not a WebView2 API.
    cdp.send("Network.enable", json!({}))?;
    cdp.send(
        "Network.setBlockedURLs",
        json!({"urls":["file://*", "filesystem:*", "chrome://*", "chrome-extension://*"]}),
    )?;
    cdp.send(
        "Emulation.setDeviceMetricsOverride",
        json!({"width":1280,"height":800,"deviceScaleFactor":1,"mobile":false}),
    )?;
    cdp.send(
        "Fetch.enable",
        json!({"patterns":[{"urlPattern":"*","requestStage":"Request"}]}),
    )?;
    // Navigation responses can arrive after request/response events. Know the main
    // frame beforehand so a fast page is not mistaken for an unconfirmed document.
    let tree = cdp.send("Page.getFrameTree", json!({}))?;
    let mut frame = loop {
        if Instant::now() >= deadline || stop.load(Ordering::Relaxed) {
            return Err("Capture timed out.".into());
        }
        let Some(event) = cdp.read()? else {
            continue;
        };
        cdp.paused(&event)?;
        if event["id"] == tree {
            break event["result"]["frameTree"]["frame"]["id"]
                .as_str()
                .ok_or("Missing capture frame.")?
                .to_string();
        }
    };
    let navigate = cdp.send("Page.navigate", json!({"url":url}))?;
    let mut document_request = String::new();
    let mut document_ok = false;
    let mut loaded = false;
    let mut settled = None;
    let mut screenshot = None;
    let mut received = None;
    while Instant::now() < deadline && !stop.load(Ordering::Relaxed) {
        let event = cdp.read()?.unwrap_or(Value::Null);
        cdp.paused(&event)?;
        if event["id"] == navigate {
            if event["result"]["errorText"].as_str().is_some() || event.get("error").is_some() {
                return Err("This page could not be rendered.".into());
            }
            frame = event["result"]["frameId"].as_str().unwrap_or("").into();
        }
        let params = &event["params"];
        if std::env::var_os("STASHDOCK_PREVIEW_DIAGNOSTICS").is_some()
            && matches!(
                event["method"].as_str(),
                Some("Network.responseReceived" | "Network.loadingFailed" | "Page.loadEventFired")
            )
        {
            eprintln!(
                "Capture event: {} {} {} {} main-frame={}",
                event["method"],
                params["type"],
                params["response"]["status"],
                params["errorText"],
                params["frameId"] == frame
            );
        }
        if event["method"] == "Network.requestWillBeSent"
            && params["type"] == "Document"
            && params["frameId"] == frame
        {
            document_request = params["requestId"].as_str().unwrap_or("").into();
            document_ok = false;
            loaded = false;
            settled = None;
        }
        if event["method"] == "Network.responseReceived"
            && params["type"] == "Document"
            && params["frameId"] == frame
        {
            let status = params["response"]["status"].as_u64().unwrap_or(0);
            let public = params["response"]["url"]
                .as_str()
                .is_some_and(|url| crate::public_web::web_url(url).is_ok());
            document_ok = (200..300).contains(&status) && public;
            if !document_ok {
                return Err("The website requires access or returned an error.".into());
            }
            received = Some(Instant::now());
        }
        if event["method"] == "Network.loadingFailed" && params["requestId"] == document_request {
            return Err("The website could not be loaded.".into());
        }
        if event["method"] == "Page.loadEventFired" {
            loaded = true;
        }
        if document_ok && loaded && settled.is_none() {
            settled = Some(Instant::now());
        }
        if screenshot.is_none()
            && document_ok
            && (settled.is_some_and(|time: Instant| time.elapsed() > Duration::from_millis(1000))
                || received.is_some_and(|time: Instant| time.elapsed() > Duration::from_secs(5)))
        {
            if std::env::var_os("STASHDOCK_PREVIEW_DIAGNOSTICS").is_some() {
                eprintln!("Capture screenshot requested");
            }
            screenshot = Some(cdp.send(
                "Page.captureScreenshot",
                json!({"format":"jpeg","quality":78,"captureBeyondViewport":false,"clip":{"x":0,"y":0,"width":1264,"height":800,"scale":1}}),
            )?);
        }
        if screenshot.is_some_and(|id| event["id"] == id) {
            let data = event["result"]["data"]
                .as_str()
                .ok_or("Screenshot could not be read.")?;
            if data.len() > 5_000_000 {
                return Err("Screenshot is too large.".into());
            }
            return crate::web_images::raster(
                &STANDARD.decode(data).map_err(|_| "Invalid screenshot.")?,
                false,
            );
        }
    }
    Err("Screenshot timed out.".into())
}
pub fn capture(url: &str, stop: &AtomicBool) -> Result<String, String> {
    let url = crate::public_web::web_url(url)?;
    crate::public_web::resolve_public(
        url.host_str().unwrap(),
        url.port_or_known_default().unwrap(),
    )?;
    let deadline = Instant::now() + Duration::from_secs(22);
    with_browser(stop, deadline, |cdp| {
        capture_page(cdp, url.as_str(), deadline, stop)
    })
}
// One private system-renderer session, bounded Job Object and public-only proxy.
fn with_browser<T>(
    stop: &AtomicBool,
    deadline: Instant,
    task: impl FnOnce(&mut Cdp) -> Result<T, String>,
) -> Result<T, String> {
    #[cfg(windows)]
    {
        if stop.load(Ordering::Relaxed) {
            return Err("Capture cancelled.".into());
        }
        let proxy = PublicProxy::start(deadline)?;
        let root = std::env::var_os("STASHDOCK_CAPTURE_PROFILE_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let profile = TempProfile(root.join(format!("stashdock-capture-{}", uuid::Uuid::new_v4())));
        fs::create_dir(&profile.0)
            .map_err(|_| "A temporary capture profile could not be created.")?;
        let session = system_webview::Session::start(profile.0.clone(), proxy.address, deadline)?;
        task(&mut Cdp { session, id: 0 })
    }
    #[cfg(not(windows))]
    {
        let _ = (stop, deadline, task);
        Err("The system renderer is not supported on this platform yet.".into())
    }
}

pub fn read_pdf(bytes: &[u8], stop: &AtomicBool) -> Result<Value, String> {
    if bytes.len() > 32 * 1024 * 1024 || !bytes.starts_with(b"%PDF-") {
        return Err("This is not a supported PDF document.".into());
    }
    let deadline = Instant::now() + Duration::from_secs(22);
    with_browser(stop, deadline, |cdp| {
        // Only our bundled modules and bytes run in this fresh about:blank page.
        // No remote module, PDF action, XFA script or original document URL runs.
        cdp.send("Network.enable", json!({}))?;
        cdp.send("Runtime.enable", json!({}))?;
        cdp.send(
            "Network.setBlockedURLs",
            json!({"urls":["http://*","https://*","file://*","filesystem:*","chrome://*"]}),
        )?;
        let data = STANDARD.encode(bytes);
        let parser = include_str!("../pdf-runtime/pdf-bundle.js");
        let script = format!(
            r#"(async () => {{
          console.log('PDF stage: start');
          {parser}
          const pdfjs = StashDockPdf;
          console.log('PDF stage: parser ready');
          const bytes = Uint8Array.from(atob('{data}'), c => c.charCodeAt(0));
          const loading = pdfjs.getDocument({{data:bytes,enableXfa:false,disableFontFace:true,useSystemFonts:true,stopAtErrors:true}});
          const pdf = await loading.promise;
          console.log('PDF stage: document ready');
          if (pdf.numPages > 1000) throw Error('This PDF has too many pages to read automatically.');
          const info = await pdf.getMetadata().catch(() => ({{info:{{}}}}));
          let content = '', first = '';
          for (let n=1; n<=pdf.numPages && content.length<50000; n++) {{
            const page = await pdf.getPage(n);
            const text = await page.getTextContent();
            const body = text.items.map(item => item.str ? item.str+(item.hasEOL?'\n':' ') : '').join('').trim();
            if(n===1) first=body;
            content += body+'\n\n';
            if(n>1) page.cleanup();
          }}
          console.log('PDF stage: text ready');
          const page = await pdf.getPage(1), base = page.getViewport({{scale:1}});
          if(!Number.isFinite(base.width*base.height) || base.width<=0 || base.height<=0 || base.width>20000 || base.height>20000) throw Error('Unsupported PDF page size.');
          const viewport = page.getViewport({{scale:Math.min(1120/base.width,760/base.height)}});
          const canvas = document.createElement('canvas'); canvas.width=Math.ceil(viewport.width); canvas.height=Math.ceil(viewport.height);
          document.body.replaceChildren(canvas); document.body.style.cssText='margin:0;min-height:800px;display:flex;justify-content:center;align-items:flex-start;padding-top:20px;background:white';
          await page.render({{canvas,canvasContext:canvas.getContext('2d'),viewport,background:'white'}}).promise;
          console.log('PDF stage: image ready');
          const title = (typeof info.info?.Title==='string' && info.info.Title.trim()) || first.split('\n').map(s=>s.trim()).find(Boolean) || '';
          await loading.destroy();
          return {{title:title.slice(0,500),content:content.trim().slice(0,50000)}};
        }})()"#
        );
        let request = cdp.send(
            "Runtime.evaluate",
            json!({"expression":script,"awaitPromise":true,"returnByValue":true}),
        )?;
        let mut metadata = None;
        while Instant::now() < deadline && !stop.load(Ordering::Relaxed) {
            let Some(event) = cdp.read()? else {
                continue;
            };
            if std::env::var_os("STASHDOCK_PREVIEW_DIAGNOSTICS").is_some()
                && event["method"] == "Runtime.consoleAPICalled"
            {
                if let Some(stage) = event["params"]["args"][0]["value"]
                    .as_str()
                    .filter(|s| s.starts_with("PDF stage:"))
                {
                    eprintln!("{stage}");
                }
            }
            if event["id"] == request {
                if event["result"].get("exceptionDetails").is_some() || event.get("error").is_some()
                {
                    if std::env::var_os("STASHDOCK_PREVIEW_DIAGNOSTICS").is_some() {
                        eprintln!(
                            "PDF renderer: {}",
                            event["result"]["exceptionDetails"]["exception"]["description"]
                        );
                    }
                    return Err(
                        "This PDF could not be read automatically. Enter its details manually."
                            .into(),
                    );
                }
                metadata = Some(event["result"]["result"]["value"].clone());
                break;
            }
        }
        let mut metadata = metadata.ok_or("This PDF took too long to read. Retry the lookup.")?;
        let image = cdp.send("Page.captureScreenshot", json!({"format":"jpeg","quality":78,"captureBeyondViewport":false,"clip":{"x":0,"y":0,"width":1264,"height":800,"scale":1}}))?;
        while Instant::now() < deadline && !stop.load(Ordering::Relaxed) {
            let Some(event) = cdp.read()? else {
                continue;
            };
            if event["id"] == image {
                let data = event["result"]["data"]
                    .as_str()
                    .filter(|s| s.len() < 5_000_000)
                    .ok_or("PDF preview could not be read.")?;
                metadata["preview"] = json!(crate::web_images::raster(
                    &STANDARD.decode(data).map_err(|_| "Invalid PDF preview.")?,
                    false
                )?);
                return Ok(metadata);
            }
        }
        Err("PDF preview timed out. Retry the lookup.".into())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn proxy_rejects_unsafe_transports_and_blocks_loopback_connections() {
        for (method, target) in [
            ("CONNECT", "127.0.0.1:17863"),
            ("CONNECT", "example.org:22"),
            ("GET", "file:///secret"),
            ("POST", "http://example.org"),
        ] {
            assert!(proxy_target(method, target).is_err());
        }
        let deadline = Instant::now() + Duration::from_secs(3);
        let proxy = PublicProxy::start(deadline).unwrap();
        let mut stream = TcpStream::connect(proxy.address).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(2)))
            .unwrap();
        stream
            .write_all(b"GET http://127.0.0.1/ HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n")
            .unwrap();
        let mut response = [0; 128];
        let n = stream.read(&mut response).unwrap();
        assert!(std::str::from_utf8(&response[..n])
            .unwrap()
            .contains("403 Forbidden"));
    }
    #[test]
    fn system_proxy_configuration_is_explicit_and_credentials_are_rejected() {
        assert_eq!(
            proxy_address("http://127.0.0.1:12334").unwrap().port(),
            12334
        );
        assert_eq!(
            proxy_address("http=127.0.0.1:80;https=127.0.0.1:443")
                .unwrap()
                .port(),
            443
        );
        for raw in [
            "https://127.0.0.1:12334",
            "user:secret@127.0.0.1:80",
            "127.0.0.1:0",
            "127.0.0.1:80/path",
            "proxy.example:80",
        ] {
            assert!(proxy_address(raw).is_none());
        }
    }
    #[test]
    fn trusted_system_proxy_receives_only_the_pinned_public_destination() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let task = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(2)))
                .unwrap();
            let mut bytes = Vec::new();
            while !bytes.ends_with(b"\r\n\r\n") {
                let mut byte = [0];
                stream.read_exact(&mut byte).unwrap();
                bytes.push(byte[0]);
            }
            assert!(String::from_utf8(bytes)
                .unwrap()
                .starts_with("CONNECT 1.1.1.1:443 HTTP/1.1\r\n"));
            stream
                .write_all(b"HTTP/1.1 200 Connection established\r\n\r\n")
                .unwrap();
        });
        connect_upstream(
            address,
            "1.1.1.1:443".parse().unwrap(),
            Duration::from_secs(2),
        )
        .unwrap();
        task.join().unwrap();
        assert!(crate::public_web::resolve_public("127.0.0.1", 443).is_err());
    }
    #[test]
    fn live_public_capture_when_requested() {
        if std::env::var("STASHDOCK_CAPTURE_SMOKE").as_deref() != Ok("1") {
            return;
        }
        let url = std::env::var("STASHDOCK_CAPTURE_SMOKE_URL")
            .unwrap_or_else(|_| "https://example.org".into());
        let data = capture(&url, &AtomicBool::new(false)).expect("real public capture");
        let bytes = STANDARD.decode(data.split_once(',').unwrap().1).unwrap();
        let destination = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../output/playwright/native-web-preview.jpg");
        fs::create_dir_all(destination.parent().unwrap()).unwrap();
        fs::write(destination, bytes).unwrap();
        eprintln!("Isolated public capture returned a raster thumbnail. No collection writes.");
    }
}
