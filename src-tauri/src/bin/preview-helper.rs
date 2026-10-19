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
#[path = "../public_web.rs"]
mod public_web;
#[path = "../web_images.rs"]
mod web_images;
use serde::Deserialize;
use serde_json::json;
use std::{
    io::{self, Read},
    sync::atomic::AtomicBool,
    time::{Duration, Instant},
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
fn run(request: Request) -> Result<serde_json::Value, String> {
    match request {
        Request::Web(request) => web(request),
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
fn web(request: WebRequest) -> Result<serde_json::Value, String> {
    let url = public_web::web_url(&request.url)?;
    if request.lookup {
        let data = link_metadata::fetch_preview_inline(url.as_str())?;
        return serde_json::to_value(data).map_err(|_| "Page details could not be read.".into());
    }
    public_web::resolve_public(
        url.host_str().unwrap(),
        url.port_or_known_default().unwrap(),
    )?;
    let metadata =
        public_web::fetch_document(url.as_str(), Instant::now() + Duration::from_secs(18)).ok();
    if let Some(pdf) = metadata
        .as_ref()
        .filter(|p| p.content_type.contains("application/pdf") || p.bytes.starts_with(b"%PDF-"))
    {
        let data = preview_browser::read_pdf(&pdf.bytes, &AtomicBool::new(false))?;
        return Ok(
            json!({"preview":data["preview"],"previewKind":"screenshot","faviconUrl":null,"error":null}),
        );
    }
    let mut candidates = Vec::new();
    let mut cover = None;
    if let Some(page) = metadata
        .as_ref()
        .filter(|p| p.content_type.contains("html"))
    {
        let doc = scraper::Html::parse_document(&String::from_utf8_lossy(&page.bytes));
        if let Ok(selector) = scraper::Selector::parse("link[rel~='icon']") {
            for node in doc.select(&selector).take(4) {
                if let Some(href) = node
                    .value()
                    .attr("href")
                    .and_then(|s| page.url.join(s).ok())
                {
                    candidates.push(href.to_string());
                }
            }
        }
        if let Ok(selector) =
            scraper::Selector::parse("meta[property='og:image'],meta[name='twitter:image']")
        {
            cover = doc.select(&selector).find_map(|node| {
                page.url
                    .join(node.value().attr("content")?)
                    .ok()
                    .map(String::from)
            });
        }
    }
    if let Some(icon) = request.favicon_url {
        candidates.insert(0, icon);
    }
    candidates.push(url.join("/favicon.ico").unwrap().to_string());
    candidates.push(url.join("/favicon.svg").unwrap().to_string());
    candidates.push(url.join("/favicon.png").unwrap().to_string());
    candidates.push(url.join("/apple-touch-icon.png").unwrap().to_string());
    let icon_deadline = Instant::now() + Duration::from_secs(6);
    let favicon = candidates
        .iter()
        .take(6)
        .find_map(|s| web_images::download(s, true, icon_deadline).ok());
    let mut kind = "screenshot";
    let mut reason = None;
    let preview = if request.need_preview {
        match preview_browser::capture(url.as_str(), &AtomicBool::new(false)) {
            Ok(data) => Some(data),
            Err(error) => {
                reason = Some(error);
                kind = "cover";
                cover.and_then(|s| {
                    web_images::download(&s, false, Instant::now() + Duration::from_secs(5)).ok()
                })
            }
        }
    } else {
        None
    };
    Ok(
        json!({"preview":preview,"previewKind":preview.as_ref().map(|_|kind),"faviconUrl":favicon,"error":if preview.is_none() { reason } else { None }}),
    )
}
fn main() {
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
        .and_then(run);
    println!("{}", result.unwrap_or_else(|error| json!({"error":error})));
}
