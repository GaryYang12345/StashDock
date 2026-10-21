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
}
#[derive(Default)]
struct Metadata {
    icon: Option<String>,
    pdf: Option<Vec<u8>>,
}
trait Source {
    fn capture(&self, url: &str, stop: &AtomicBool) -> Option<String>;
    fn metadata(&self, url: &str) -> Metadata;
    fn icon(&self, url: &str, deadline: Instant) -> Option<String>;
    fn pdf(&self, bytes: &[u8], stop: &AtomicBool) -> Option<String>;
}
struct PublicSource<F>(F);
impl<F: Fn(&str, Instant) -> Option<String>> Source for PublicSource<F> {
    fn capture(&self, url: &str, stop: &AtomicBool) -> Option<String> {
        match crate::preview_cache::capture(url, stop) {
            Ok(image) => Some(image),
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
}
pub fn enrich(
    url: &str,
    needs_preview: bool,
    favicon: Option<&str>,
    stop: &AtomicBool,
    changed: impl Fn(&Images),
    download_icon: impl Fn(&str, Instant) -> Option<String>,
) -> Images {
    acquire(
        url,
        needs_preview,
        favicon,
        stop,
        &PublicSource(download_icon),
        changed,
    )
}
fn acquire(
    url: &str,
    needs_preview: bool,
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
        images.preview = source.capture(url, stop);
        if images.preview.is_some() {
            images.preview_kind = Some("screenshot".into());
            changed(&images); // Do not hold the visible screenshot behind icon work.
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
        fn capture(&self, _: &str, _: &AtomicBool) -> Option<String> {
            self.events.borrow_mut().push("capture");
            self.success.then(|| "image".into())
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
            None,
            &AtomicBool::new(true),
            &source,
            |_| {},
        );
        assert!(source.events.borrow().is_empty());
    }
    #[test]
    fn cancellation_after_publishing_a_screenshot_skips_optional_network_work() {
        let source = Fake {
            events: RefCell::new(vec![]),
            success: true,
        };
        let stop = AtomicBool::new(false);
        let images = acquire("https://example.org", true, None, &stop, &source, |_| {
            stop.store(true, Ordering::Relaxed);
        });
        assert!(images.preview.is_some());
        assert_eq!(*source.events.borrow(), ["capture"]);
    }
}
