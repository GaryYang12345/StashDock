use scraper::{Html, Selector};
use serde::Serialize;
use std::{
    sync::atomic::AtomicBool,
    time::{Duration, Instant},
};
use url::Url;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkPreview {
    pub title: String,
    pub content: String,
    pub favicon_url: Option<String>,
    #[serde(skip)]
    pub cover_url: Option<String>,
    pub preview: Option<String>,
    pub preview_kind: Option<String>,
}

pub(crate) fn fetch_preview_inline(url: &str) -> Result<LinkPreview, String> {
    let mut preview = fetch_preview(url)?;
    preview.favicon_url = preview.favicon_url.and_then(|value| {
        if value.starts_with("data:image/") {
            Some(value)
        } else {
            crate::web_images::download(&value, true, Instant::now() + Duration::from_secs(3)).ok()
        }
    });
    Ok(preview)
}

pub(crate) fn extract_preview(html: &str, url: &Url) -> LinkPreview {
    let document = Html::parse_document(html);
    let select = |query: &str| Selector::parse(query).unwrap();
    let meta = |query: &str| {
        document.select(&select(query)).find_map(|node| {
            node.value()
                .attr("content")
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .map(str::to_string)
        })
    };
    let title = meta("meta[property='og:title']")
        .or_else(|| {
            document
                .select(&select("title"))
                .next()
                .map(|node| node.text().collect::<String>())
        })
        .unwrap_or_else(|| url.host_str().unwrap_or("Link").into());
    let root = document
        .select(&select("article, main, [role='main']"))
        .next();
    let mut parts = Vec::new();
    let mut length = 0;
    if let Some(root) = root {
        for node in root.select(&select("h1, h2, h3, p, li, pre, blockquote")) {
            if node.ancestors().any(|parent| {
                parent.value().as_element().is_some_and(|el| {
                    matches!(
                        el.name(),
                        "nav" | "header" | "footer" | "script" | "style" | "noscript"
                    )
                })
            }) {
                continue;
            }
            // Skip nested paragraphs/list entries already represented by a selected parent.
            if node.ancestors().any(|parent| {
                parent.id() != root.id()
                    && parent
                        .value()
                        .as_element()
                        .is_some_and(|el| matches!(el.name(), "li" | "pre" | "blockquote"))
            }) {
                continue;
            }
            let text = node
                .text()
                .collect::<Vec<_>>()
                .join(" ")
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
            if !text.is_empty() {
                length += text.len();
                parts.push(text);
            }
            if length >= 50_000 {
                break;
            }
        }
    }
    let content = if parts.is_empty() {
        meta("meta[name='description'], meta[property='og:description']").unwrap_or_default()
    } else {
        parts.join("\n\n")
    };
    let favicon_url = document
        .select(&select("link[rel~='icon']"))
        .find_map(|node| {
            url.join(node.value().attr("href")?)
                .ok()
                .filter(|link| crate::public_web::web_url(link.as_str()).is_ok())
                .map(String::from)
        });
    let cover_url = meta("meta[property='og:image'], meta[name='twitter:image']")
        .and_then(|raw| url.join(&raw).ok())
        .filter(|link| crate::public_web::web_url(link.as_str()).is_ok())
        .map(String::from);
    LinkPreview {
        title: title
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(500)
            .collect(),
        content: content.chars().take(50_000).collect(),
        favicon_url,
        cover_url,
        preview: None,
        preview_kind: None,
    }
}

pub fn fetch_preview(value: &str) -> Result<LinkPreview, String> {
    fetch_preview_with_images(value, true)
}
pub fn fetch_preview_with_images(value: &str, images: bool) -> Result<LinkPreview, String> {
    let url = crate::public_web::web_url(value)?;
    // Start image work as soon as a valid link is entered, not after saving it.
    // Known PDF paths use the document renderer instead of downloading in a tab.
    let pdf_path =
        url.path().to_ascii_lowercase().ends_with(".pdf") || url.path().starts_with("/pdf/");
    if images && !pdf_path {
        crate::preview_cache::start(value);
    }
    let response =
        crate::public_web::fetch_document(value, Instant::now() + Duration::from_secs(18))?;
    if response.content_type.contains("application/pdf") || response.bytes.starts_with(b"%PDF-") {
        let document = crate::preview_browser::read_pdf(&response.bytes, &AtomicBool::new(false))?;
        return Ok(LinkPreview {
            title: document["title"]
                .as_str()
                .filter(|s| !s.trim().is_empty())
                .unwrap_or(
                    response
                        .url
                        .path_segments()
                        .and_then(|s| s.last())
                        .unwrap_or("PDF"),
                )
                .chars()
                .take(500)
                .collect(),
            content: document["content"]
                .as_str()
                .unwrap_or("")
                .chars()
                .take(50_000)
                .collect(),
            favicon_url: response.url.join("/favicon.ico").ok().map(String::from),
            cover_url: None,
            preview: document["preview"].as_str().map(String::from),
            preview_kind: Some("screenshot".into()),
        });
    }
    if !response.content_type.contains("html") {
        return Err(
            "This document format cannot be read automatically. Enter its details manually.".into(),
        );
    }
    let mut data = extract_preview(&String::from_utf8_lossy(&response.bytes), &response.url);
    let icon_deadline = Instant::now() + Duration::from_secs(6);
    let candidates = data.favicon_url.iter().cloned().chain(
        [
            "/favicon.ico",
            "/favicon.svg",
            "/favicon.png",
            "/apple-touch-icon.png",
        ]
        .into_iter()
        .filter_map(|path| response.url.join(path).ok().map(String::from)),
    );
    data.favicon_url = candidates
        .take(6)
        .find_map(|icon| crate::web_images::download(&icon, true, icon_deadline).ok());
    data.preview = if images {
        crate::preview_cache::capture(value, &AtomicBool::new(false)).ok()
    } else {
        None
    };
    data.preview_kind = data.preview.as_ref().map(|_| "screenshot".into());
    if images && data.preview.is_none() {
        data.preview = data.cover_url.as_ref().and_then(|url| {
            crate::web_images::download(url, false, Instant::now() + Duration::from_secs(5)).ok()
        });
        data.preview_kind = data.preview.as_ref().map(|_| "cover".into());
    }
    Ok(data)
}
