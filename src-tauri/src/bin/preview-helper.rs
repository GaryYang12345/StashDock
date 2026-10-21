// Standalone renderer: no Tauri window, desktop process, MCP or user library access.
#[allow(dead_code)]
#[path = "../link_import.rs"]
mod link_import;
#[path = "../link_metadata.rs"]
mod link_metadata;
#[allow(dead_code)]
#[path = "../preview_browser.rs"]
mod preview_browser;
#[path = "../preview_cache.rs"]
mod preview_cache;
#[path = "../preview_enrichment.rs"]
mod preview_enrichment;
#[path = "../public_web.rs"]
mod public_web;
#[path = "../web_images.rs"]
mod web_images;
use serde::Deserialize;
use serde_json::json;
use std::{
    io::{self, BufRead, Read, Write},
    sync::atomic::AtomicBool,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WebRequest {
    url: String,
    #[serde(default = "yes")]
    need_preview: bool,
    favicon_url: Option<String>,
    #[serde(default)]
    lookup: bool,
    #[serde(default)]
    content_only: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BrowserRequest {
    browser_operation: String,
    source_id: Option<String>,
    urls: Option<Vec<String>>,
}
#[derive(Deserialize)]
#[serde(untagged)]
enum Request {
    Web(WebRequest),
    Browser(BrowserRequest),
    Image(ImageRequest),
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ImageRequest {
    image_operation: String,
    base64: String,
}
fn yes() -> bool {
    true
}
fn run(
    request: Request,
    progress: impl Fn(&preview_enrichment::Images),
) -> Result<serde_json::Value, String> {
    match request {
        Request::Web(request) => web(request, progress),
        Request::Image(request) => {
            if request.image_operation != "cover" {
                return Err("Unsupported image request.".into());
            }
            Ok(json!({"preview":web_images::cover_base64(&request.base64)?}))
        }
        Request::Browser(request) => match request.browser_operation.as_str() {
            "sources" => serde_json::to_value(link_import::browser_sources_snapshot()?)
                .map_err(|_| "Browser profiles could not be read.".into()),
            "bookmarks" => serde_json::to_value(link_import::browser_bookmarks_snapshot(
                &request.source_id.ok_or("Choose a browser source.")?,
            )?)
            .map_err(|_| "Bookmarks could not be read.".into()),
            "icons" => serde_json::to_value(link_import::bookmark_icons(
                &request.urls.ok_or("Choose bookmark URLs.")?,
            )?)
            .map_err(|_| "Bookmark icons could not be read.".into()),
            _ => Err("Unsupported browser request.".into()),
        },
    }
}
fn web(
    request: WebRequest,
    progress: impl Fn(&preview_enrichment::Images),
) -> Result<serde_json::Value, String> {
    let url = public_web::web_url(&request.url)?;
    if request.content_only {
        return serde_json::to_value(link_metadata::fetch_content(url.as_str())?)
            .map_err(|_| "Page content could not be read.".into());
    }
    if request.lookup {
        let data = link_metadata::fetch_preview_inline(url.as_str())?;
        return serde_json::to_value(data).map_err(|_| "Page details could not be read.".into());
    }
    let images = preview_enrichment::enrich(
        url.as_str(),
        request.need_preview,
        request.favicon_url.as_deref(),
        &AtomicBool::new(false),
        progress,
        |url, deadline| web_images::download(url, true, deadline).ok(),
    );
    serde_json::to_value(images).map_err(|_| "Preview could not be read.".into())
}
fn main() {
    if std::env::args().nth(1).as_deref() == Some("--serve") {
        serve();
        preview_browser::shutdown_renderer();
        return;
    }
    let mut bytes = Vec::new();
    let result = io::stdin()
        .take(6_670_001)
        .read_to_end(&mut bytes)
        .map_err(|_| "Invalid capture request".to_string())
        .and_then(|_| {
            if bytes.len() > 6_670_000 {
                Err("Capture request is too large".into())
            } else {
                let request = serde_json::from_slice::<Request>(&bytes)
                    .map_err(|_| "Invalid capture request".to_string())?;
                if bytes.len() > 150_000 && !matches!(request, Request::Image(_)) {
                    return Err("Capture request is too large".into());
                }
                Ok(request)
            }
        })
        .and_then(|request| run(request, |_| {}));
    println!("{}", result.unwrap_or_else(|error| json!({"error":error})));
    preview_browser::shutdown_renderer();
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    id: u64,
    request: Request,
}

fn output(value: serde_json::Value) -> io::Result<()> {
    let mut stdout = io::stdout().lock();
    serde_json::to_writer(&mut stdout, &value)?;
    stdout.write_all(b"\n")?;
    stdout.flush()
}

// Parent-owned, serial NDJSON protocol. Never retain unbounded input or accept
// filesystem paths from pages. Each task keeps the existing renderer deadline.
fn serve() {
    let mut input = io::stdin().lock();
    loop {
        let mut bytes = Vec::new();
        match input.by_ref().take(150_001).read_until(b'\n', &mut bytes) {
            Ok(0) => break,
            Ok(_) if bytes.len() <= 150_000 && bytes.last() == Some(&b'\n') => {}
            _ => break,
        }
        let Ok(envelope) = serde_json::from_slice::<Envelope>(&bytes) else {
            break;
        };
        let id = envelope.id;
        let result = run(envelope.request, |images| {
            let _ = output(json!({"id":id,"event":"images","value":images}));
        })
        .unwrap_or_else(|error| json!({"error":error}));
        let mut response = json!({"id":id,"result":result});
        if std::env::var_os("STASHDOCK_CAPTURE_DIAGNOSTICS").is_some() {
            response["renderer"] = preview_browser::renderer_statistics();
        }
        if output(response).is_err() {
            break;
        }
    }
}
