//! Background image work shared by Desktop and the standalone plugin helper.
//! Screenshot first, once per attempt. Saved browser icons avoid HTML fetches;
//! Metadata is only needed for icon maintenance or a PDF document.
use serde::Serialize;
use std::{
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Images {
    pub preview: Option<String>,
    pub preview_kind: Option<String>,
    pub favicon_url: Option<String>,
    /// Title and body read from the same render as the screenshot; the queue
    /// uses them only to fill a reference whose text is still missing.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
}
#[derive(Default)]
struct Metadata {
    icon: Option<String>,
    pdf: Option<Vec<u8>>,
}
trait Source {
    fn capture(&self, url: &str, stop: &AtomicBool) -> Option<crate::preview_browser::Rendered>;
    fn metadata(&self, url: &str) -> Metadata;
    fn icon(&self, url: &str, deadline: Instant) -> Option<String>;
    fn pdf(&self, bytes: &[u8], stop: &AtomicBool) -> Option<String>;
    /// Direct document read: (title, body).
    fn direct_text(&self, url: &str) -> Option<(String, String)>;
}

struct PublicSource<F>(F);
impl<F: Fn(&str, Instant) -> Option<String>> Source for PublicSource<F> {
    fn capture(&self, url: &str, stop: &AtomicBool) -> Option<crate::preview_browser::Rendered> {
        match crate::preview_cache::capture(url, stop) {
            Ok(rendered) => Some(rendered),
            Err(error) => {
                if std::env::var_os("STASHDOCK_PREVIEW_DIAGNOSTICS").is_some() {
                    eprintln!("Capture failure: {error}");
                }
                None
            }
        }
    }
    fn metadata(&self, url: &str) -> Metadata {
        let Ok(page) =
            crate::public_web::fetch_document(url, Instant::now() + Duration::from_secs(8))
        else {
            return Metadata::default();
        };
        if page.content_type.contains("application/pdf") || page.bytes.starts_with(b"%PDF-") {
            return Metadata {
                pdf: Some(page.bytes),
                ..Metadata::default()
            };
        }
        if !page.content_type.contains("html") {
            return Metadata::default();
        }
        let html = scraper::Html::parse_document(&String::from_utf8_lossy(&page.bytes));
        let select = |s| scraper::Selector::parse(s).unwrap();
        Metadata {
            icon: html.select(&select("link[rel~='icon']")).find_map(|node| {
                page.url
                    .join(node.value().attr("href")?)
                    .ok()
                    .map(String::from)
            }),
            pdf: None,
        }
    }
    fn icon(&self, url: &str, deadline: Instant) -> Option<String> {
        (self.0)(url, deadline)
    }
    fn pdf(&self, bytes: &[u8], stop: &AtomicBool) -> Option<String> {
        crate::preview_browser::render_pdf_cover(bytes, stop).ok()
    }
    fn direct_text(&self, url: &str) -> Option<(String, String)> {
        crate::link_metadata::fetch_content(url)
            .ok()
            .map(|page| (page.title, page.content))
    }
}
pub fn enrich(
    url: &str,
    needs_preview: bool,
    needs_text: bool,
    favicon: Option<&str>,
    stop: &AtomicBool,
    changed: impl Fn(&Images),
    download_icon: impl Fn(&str, Instant) -> Option<String>,
) -> Images {
    acquire(
        url,
        needs_preview,
        needs_text,
        favicon,
        stop,
        &PublicSource(download_icon),
        changed,
    )
}
fn acquire(
    url: &str,
    needs_preview: bool,
    needs_text: bool,
    favicon: Option<&str>,
    stop: &AtomicBool,
    source: &impl Source,
    changed: impl Fn(&Images),
) -> Images {
    let mut images = Images {
        favicon_url: favicon
            .filter(|s| s.starts_with("data:image/"))
            .map(String::from),
        ..Images::default()
    };
    let Ok(parsed) = crate::public_web::web_url(url) else {
        return images;
    };
    if stop.load(Ordering::Relaxed) {
        return images;
    }
    let pdf_path =
        parsed.path().to_ascii_lowercase().ends_with(".pdf") || parsed.path().starts_with("/pdf/");
    if needs_preview && !pdf_path {
        if let Some(rendered) = source.capture(url, stop) {
            images.preview = rendered.image;
            images.title = Some(rendered.title).filter(|title| !title.trim().is_empty());
            images.content = Some(rendered.content).filter(|content| !content.trim().is_empty());
        }
        if images.preview.is_some() {
            images.preview_kind = Some("screenshot".into());
        }
        // Only when the render produced no text (for example a page that
        // blocks it) does the same job read the page directly, after the
        // screenshot has been published so the cover never waits for it.
        let compare = needs_text && images.content.is_none();
        if images.preview.is_some() || images.content.is_some() {
            changed(&images); // Do not hold the visible screenshot behind icon work.
        }
        if compare && !stop.load(Ordering::Relaxed) {
            if let Some((title, content)) = source.direct_text(url) {
                if !content.trim().is_empty() {
                    images.content = Some(content);
                }
                if images.title.is_none() && !title.trim().is_empty() {
                    images.title = Some(title);
                }
            }
            if images.content.is_some() {
                changed(&images);
            }
        }
    }
    if stop.load(Ordering::Relaxed)
        // Missing-cover jobs must not serialize an extra HTML + favicon fetch
        // ahead of the next screenshot. The existing icon-only queue handles
        // this later, below every missing cover, without another renderer.
        || (needs_preview && images.preview.is_some())
        // A failed screenshot returns immediately to its one retry. Never hide
        // failure with an OG image or hold that retry behind optional metadata.
        || (needs_preview && !pdf_path)
        || ((!needs_preview || images.preview.is_some()) && images.favicon_url.is_some())
    {
        return images;
    }
    let metadata = source.metadata(url);
    if stop.load(Ordering::Relaxed) {
        return images;
    }
    if needs_preview && images.preview.is_none() {
        if let Some(bytes) = metadata.pdf.as_deref() {
            images.preview = source.pdf(bytes, stop);
            images.preview_kind = images.preview.as_ref().map(|_| "screenshot".into());
        }
        if images.preview.is_some() {
            changed(&images);
        }
    }
    if images.favicon_url.is_none() {
        let deadline = Instant::now() + Duration::from_secs(4);
        let mut candidates = Vec::new();
        for icon in metadata.icon.as_deref().into_iter().chain(favicon) {
            if !candidates.iter().any(|s| s == icon) {
                candidates.push(icon.to_string());
            }
        }
        for path in [
            "/favicon.ico",
            "/favicon.svg",
            "/favicon.png",
            "/apple-touch-icon.png",
        ] {
            if let Ok(icon) = parsed.join(path) {
                let icon = String::from(icon);
                if !candidates.contains(&icon) {
                    candidates.push(icon);
                }
            }
        }
        for icon in candidates.into_iter().take(6) {
            if stop.load(Ordering::Relaxed) || Instant::now() >= deadline {
                break;
            }
            if let Some(data) = source.icon(&icon, deadline) {
                images.favicon_url = Some(data);
                changed(&images);
                break;
            }
        }
    }
    images
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    struct Fake {
        events: RefCell<Vec<&'static str>>,
        success: bool,
    }
    impl Source for Fake {
        fn capture(&self, _: &str, _: &AtomicBool) -> Option<crate::preview_browser::Rendered> {
            self.events.borrow_mut().push("capture");
            self.success.then(|| crate::preview_browser::Rendered {
                image: Some("image".into()),
                title: "Rendered title".into(),
                content: "Rendered body".into(),
            })
        }
        fn metadata(&self, _: &str) -> Metadata {
            self.events.borrow_mut().push("metadata");
            Metadata {
                icon: Some("https://example.org/favicon.ico".into()),
                ..Metadata::default()
            }
        }
        fn icon(&self, _: &str, _: Instant) -> Option<String> {
            self.events.borrow_mut().push("icon");
            Some("image".into())
        }
        fn direct_text(&self, _: &str) -> Option<(String, String)> {
            self.events.borrow_mut().push("direct");
            Some(("Direct title".into(), "Direct body".into()))
        }
        fn pdf(&self, _: &[u8], _: &AtomicBool) -> Option<String> {
            self.events.borrow_mut().push("pdf");
            Some("image".into())
        }
    }
    #[test]
    fn imported_browser_icon_skips_metadata_and_screenshot_is_published_first() {
        let source = Fake {
            events: RefCell::new(vec![]),
            success: true,
        };
        let result = acquire(
            "https://example.org",
            true,
            false,
            Some("data:image/png;base64,YQ=="),
            &AtomicBool::new(false),
            &source,
            |_| source.events.borrow_mut().push("publish"),
        );
        assert_eq!(*source.events.borrow(), ["capture", "publish"]);
        assert_eq!(result.preview_kind.as_deref(), Some("screenshot"));
        source.events.borrow_mut().clear();
        acquire(
            "https://example.org",
            true,
            false,
            None,
            &AtomicBool::new(false),
            &source,
            |_| source.events.borrow_mut().push("publish"),
        );
        assert_eq!(*source.events.borrow(), ["capture", "publish"]);
    }
    #[test]
    fn failures_return_immediately_for_retry_and_icons_never_launch_a_browser() {
        let source = Fake {
            events: RefCell::new(vec![]),
            success: false,
        };
        let result = acquire(
            "https://example.org",
            true,
            false,
            None,
            &AtomicBool::new(false),
            &source,
            |_| {},
        );
        assert_eq!(*source.events.borrow(), ["capture"]);
        assert!(result.preview.is_none());
        source.events.borrow_mut().clear();
        acquire(
            "https://example.org",
            false,
            false,
            None,
            &AtomicBool::new(false),
            &source,
            |_| {},
        );
        assert_eq!(*source.events.borrow(), ["metadata", "icon"]);
        source.events.borrow_mut().clear();
        acquire(
            "https://example.org",
            true,
            false,
            None,
            &AtomicBool::new(true),
            &source,
            |_| {},
        );
        assert!(source.events.borrow().is_empty());
    }
    #[test]
    fn a_render_without_text_falls_back_to_a_direct_read_after_the_cover() {
        let source = Fake {
            events: RefCell::new(vec![]),
            success: false,
        };
        let images = acquire(
            "https://example.org",
            true,
            true,
            None,
            &AtomicBool::new(false),
            &source,
            |_| {},
        );
        assert_eq!(*source.events.borrow(), ["capture", "direct"]);
        assert_eq!(images.content.as_deref(), Some("Direct body"));
        let source = Fake {
            events: RefCell::new(vec![]),
            success: true,
        };
        let published = RefCell::new(Vec::new());
        let images = acquire(
            "https://example.org",
            true,
            true,
            None,
            &AtomicBool::new(false),
            &source,
            |images| {
                source.events.borrow_mut().push("publish");
                published.borrow_mut().push(images.content.clone());
            },
        );
        assert_eq!(
            *source.events.borrow(),
            ["capture", "publish"],
            "rendered text is used as it is"
        );
        assert_eq!(*published.borrow(), [Some("Rendered body".to_string())]);
        assert_eq!(images.content.as_deref(), Some("Rendered body"));
    }
    #[test]
    fn cancellation_after_publishing_a_screenshot_skips_optional_network_work() {
        let source = Fake {
            events: RefCell::new(vec![]),
            success: true,
        };
        let stop = AtomicBool::new(false);
        let images = acquire(
            "https://example.org",
            true,
            false,
            None,
            &stop,
            &source,
            |_| {
                stop.store(true, Ordering::Relaxed);
            },
        );
        assert!(images.preview.is_some());
        assert_eq!(*source.events.borrow(), ["capture"]);
    }
}
