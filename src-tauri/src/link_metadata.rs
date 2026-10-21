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

// Full image lookup remains available to the native helper; import forms use
// fetch_content instead so screenshots never hold their completion open.
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
    let root = [
        "article",
        "main, [role='main']",
        "[itemprop='articleBody'], #content, #main, .main-content, .entry-content, .post-content",
        "body",
    ]
    .into_iter()
    .find_map(|query| document.select(&select(query)).next());
    let mut parts = Vec::new();
    let mut length = 0;
    let mut previous_block = None;
    if let Some(root) = root {
        // Read each text node once. Legacy table/div layouts and direct text do
        // not require an article tag; inline markup cannot duplicate paragraphs.
        for node in root.descendants().take(50_000) {
            let Some(raw) = node.value().as_text() else {
                continue;
            };
            if node
                .ancestors()
                .any(|parent| parent.value().as_element().is_some_and(excluded_content))
            {
                continue;
            }
            let text = raw.split_whitespace().collect::<Vec<_>>().join(" ");
            if !text.is_empty() {
                let block = node
                    .ancestors()
                    .find(|parent| {
                        parent.value().as_element().is_some_and(|el| {
                            matches!(
                                el.name(),
                                "h1" | "h2"
                                    | "h3"
                                    | "h4"
                                    | "h5"
                                    | "h6"
                                    | "p"
                                    | "li"
                                    | "pre"
                                    | "blockquote"
                                    | "td"
                                    | "th"
                                    | "dt"
                                    | "dd"
                                    | "div"
                                    | "section"
                                    | "article"
                                    | "main"
                                    | "body"
                            )
                        })
                    })
                    .map(|parent| parent.id());
                length += text.chars().count();
                if previous_block == block && !parts.is_empty() {
                    let last: &mut String = parts.last_mut().unwrap();
                    last.push(' ');
                    last.push_str(&text);
                } else {
                    parts.push(text);
                }
                previous_block = block;
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

fn excluded_content(el: &scraper::node::Element) -> bool {
    if matches!(
        el.name(),
        "head"
            | "nav"
            | "header"
            | "footer"
            | "aside"
            | "script"
            | "style"
            | "noscript"
            | "template"
            | "form"
            | "input"
            | "textarea"
            | "select"
            | "button"
            | "iframe"
            | "svg"
            | "canvas"
    ) || el.attr("hidden").is_some()
        || el.attr("aria-hidden") == Some("true")
        || el
            .attr("contenteditable")
            .is_some_and(|value| value != "false")
        || matches!(
            el.attr("role"),
            Some("navigation" | "banner" | "contentinfo" | "complementary" | "dialog")
        )
    {
        return true;
    }
    let style = el
        .attr("style")
        .unwrap_or("")
        .split_whitespace()
        .collect::<String>()
        .to_ascii_lowercase();
    if style.contains("display:none") || style.contains("visibility:hidden") {
        return true;
    }
    el.attr("class")
        .unwrap_or("")
        .split_whitespace()
        .chain(el.attr("id"))
        .any(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "nav"
                    | "navigation"
                    | "menu"
                    | "sidebar"
                    | "comments"
                    | "comment"
                    | "recommendations"
                    | "related"
                    | "breadcrumb"
                    | "breadcrumbs"
            )
        })
}

#[cfg(test)]
mod extraction_tests {
    use super::*;
    #[test]
    fn pdf_url_context_is_metadata_only_without_network_or_renderer_work() {
        let result =
            fetch_content("https://unresolvable-fixture.invalid/reference.PDF?download=1").unwrap();
        assert_eq!(result.title, "reference.PDF");
        assert!(result.content.is_empty());
        assert!(result.preview.is_none());
        assert!(result.preview_kind.is_none());
    }
    #[test]
    fn legacy_layouts_read_text_without_semantic_article_tags() {
        let value = extract_preview(
            r#"<title>Mathematics</title><body><div id="menu">Menu secret</div><table><tr><td><b>Department</b> of Mathematics</td></tr><tr><td>News and research</td></tr></table><footer>Footer secret</footer></body>"#,
            &Url::parse("https://example.org").unwrap(),
        );
        assert!(value.content.contains("Department of Mathematics"));
        assert!(value.content.contains("News and research"));
        assert!(!value.content.contains("secret"));
    }
    #[test]
    fn hidden_private_and_unrelated_text_is_removed_without_duplicate_nested_blocks() {
        let value = extract_preview(
            r#"<main><p>Actual <b>article</b> text</p><ul><li>One <p>nested paragraph</p></li></ul><div hidden>Hidden secret</div><div aria-hidden="true">Hidden secret</div><div style="display: none">Hidden secret</div><form><textarea>Private secret</textarea></form><div contenteditable>Private secret</div><aside>Related secret</aside><div class="comments">Comment secret</div></main>"#,
            &Url::parse("https://example.org").unwrap(),
        );
        assert!(value.content.contains("Actual article text"));
        assert_eq!(value.content.matches("nested paragraph").count(), 1);
        assert!(!value.content.contains("secret"));
    }
    #[test]
    fn page_description_remains_a_fallback_and_unicode_output_stays_bounded() {
        let url = Url::parse("https://example.org").unwrap();
        assert_eq!(
            extract_preview("<meta name='description' content='Page description'>", &url).content,
            "Page description"
        );
        let value = extract_preview(
            &format!("<main><p>{}</p></main>", "字".repeat(60_000)),
            &url,
        );
        assert_eq!(value.content.chars().count(), 50_000);
    }
}

pub fn fetch_preview(value: &str) -> Result<LinkPreview, String> {
    fetch_preview_with_images(value, true)
}
/// One document reader for foreground URL imports and background bookmark imports.
/// No favicon downloads or HTML screenshot waits on the text lane.
pub fn fetch_content(value: &str) -> Result<LinkPreview, String> {
    let url = crate::public_web::web_url(value)?;
    if url.path().to_ascii_lowercase().ends_with(".pdf") {
        return Ok(pdf_link(&url));
    }
    let response =
        crate::public_web::fetch_context_document(value, Instant::now() + Duration::from_secs(18))?;
    if response.content_type.contains("application/pdf") || response.bytes.starts_with(b"%PDF-") {
        return Ok(pdf_link(&response.url));
    }
    if !response.content_type.contains("html") {
        return Err(
            "This document format cannot be read automatically. Enter its details manually.".into(),
        );
    }
    Ok(extract_preview(
        &String::from_utf8_lossy(&response.bytes),
        &response.url,
    ))
}
fn pdf_link(url: &Url) -> LinkPreview {
    LinkPreview {
        title: url
            .path_segments()
            .and_then(|s| s.last())
            .filter(|s| !s.is_empty())
            .unwrap_or("PDF")
            .chars()
            .take(500)
            .collect(),
        content: String::new(),
        favicon_url: url.join("/favicon.ico").ok().map(String::from),
        cover_url: None,
        preview: None,
        preview_kind: None,
    }
}

pub fn fetch_preview_with_images(value: &str, images: bool) -> Result<LinkPreview, String> {
    let url = crate::public_web::web_url(value)?;
    let pdf_path =
        url.path().to_ascii_lowercase().ends_with(".pdf") || url.path().starts_with("/pdf/");
    if images && !pdf_path {
        crate::preview_cache::start(value);
    }
    let mut data = fetch_content(value)?;
    let icon_deadline = Instant::now() + Duration::from_secs(6);
    let candidates = data.favicon_url.iter().cloned().chain(
        [
            "/favicon.ico",
            "/favicon.svg",
            "/favicon.png",
            "/apple-touch-icon.png",
        ]
        .into_iter()
        .filter_map(|path| url.join(path).ok().map(String::from)),
    );
    data.favicon_url = candidates
        .take(6)
        .find_map(|icon| crate::web_images::download(&icon, true, icon_deadline).ok());
    data.preview = if data.preview.is_some() {
        data.preview
    } else if images {
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
