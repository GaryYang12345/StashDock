//! Card covers reach the WebView as cacheable image URLs instead of inline data
//! URLs. A library refresh then carries a short URL per card, not every
//! screenshot again; the WebView caches each image by its content version.
use super::*;
use base64::{engine::general_purpose::STANDARD, Engine};
use tauri::http::{header, Request, Response, StatusCode};

pub const SCHEME: &str = "stashdock-preview";

/// Changes whenever the stored image changes, without hashing it.
fn version(preview: &str) -> String {
    let tail: String = preview
        .chars()
        .rev()
        .take(16)
        .filter(char::is_ascii_alphanumeric)
        .collect();
    format!("{}{}", preview.len(), tail)
}

fn url(id: &str, version: &str) -> String {
    let id: String = url::form_urlencoded::byte_serialize(id.as_bytes()).collect();
    // Tauri serves custom schemes on Windows as http://<scheme>.localhost.
    if cfg!(windows) {
        format!("http://{SCHEME}.localhost/{id}?v={version}")
    } else {
        format!("{SCHEME}://localhost/{id}?v={version}")
    }
}

/// Replace inline image data with a protocol URL before items cross IPC.
pub(crate) fn for_webview(mut items: Vec<StashItem>) -> Vec<StashItem> {
    for item in &mut items {
        if let Some(preview) = item
            .preview
            .as_deref()
            .filter(|value| value.starts_with("data:image/"))
        {
            item.preview = Some(url(&item.id, &version(preview)));
        }
    }
    items
}

fn decode(preview: &str) -> Option<(String, Vec<u8>)> {
    let (meta, data) = preview.strip_prefix("data:")?.split_once(',')?;
    let mime = meta.strip_suffix(";base64")?;
    if !mime.starts_with("image/") || mime.contains(['\r', '\n']) {
        return None;
    }
    Some((mime.to_string(), STANDARD.decode(data).ok()?))
}

fn respond(database: &Path, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let empty = |status: StatusCode| Response::builder().status(status).body(Vec::new()).unwrap();
    let path = request.uri().path().trim_start_matches('/');
    let id: String = url::form_urlencoded::parse(format!("i={path}").as_bytes())
        .find(|(key, _)| key == "i")
        .map(|(_, value)| value.into_owned())
        .unwrap_or_default();
    if id.is_empty() || id.len() > 120 {
        return empty(StatusCode::BAD_REQUEST);
    }
    let preview: Option<String> =
        Connection::open_with_flags(database, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .ok()
            .and_then(|db| {
                let _ = db.busy_timeout(std::time::Duration::from_secs(2));
                db.query_row(
                    "SELECT preview FROM stash_items WHERE id=?1",
                    [&id],
                    |row| row.get(0),
                )
                .optional()
                .ok()
                .flatten()
            });
    let Some((mime, bytes)) = preview.as_deref().and_then(decode) else {
        return empty(StatusCode::NOT_FOUND);
    };
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        // The URL carries the content version, so a cached image never goes stale.
        .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable")
        // Drag previews paint cards into a canvas; CORS keeps that canvas readable.
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header("X-Content-Type-Options", "nosniff")
        .body(bytes)
        .unwrap()
}

pub fn register<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder.register_asynchronous_uri_scheme_protocol(SCHEME, |context, request, responder| {
        let app = context.app_handle().clone();
        tauri::async_runtime::spawn_blocking(move || {
            let response = match app.try_state::<LibraryState>() {
                Some(state) => respond(state.database_path(), &request),
                None => Response::builder()
                    .status(StatusCode::SERVICE_UNAVAILABLE)
                    .body(Vec::new())
                    .unwrap(),
            };
            responder.respond(response);
        });
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn covers_cross_ipc_as_versioned_urls_and_are_served_from_the_library() {
        let root =
            std::env::temp_dir().join(format!("stashdock-preview-protocol-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let database = root.join("stashdock.sqlite3");
        let connection = Connection::open(&database).unwrap();
        initialize_schema(&connection).unwrap();
        let png = format!("data:image/png;base64,{}", STANDARD.encode(b"\x89PNG fake"));
        connection
            .execute(
                "INSERT INTO stash_items(id,title,kind,source,excerpt,tags_json,created_at,preview,updated_at) VALUES('a b','t','web','s','','[]','now',?1,'now')",
                [&png],
            )
            .unwrap();
        let items = for_webview(read_items(&connection).unwrap());
        let link = items[0].preview.clone().unwrap();
        assert!(link.contains("/a+b?v="), "{link}");
        assert!(!link.contains("base64"));
        let path = link
            .split_once(".localhost")
            .or_else(|| link.split_once("://localhost"))
            .unwrap()
            .1;
        let request = Request::builder()
            .uri(format!("{SCHEME}://localhost{path}"))
            .body(Vec::new())
            .unwrap();
        let response = respond(&database, &request);
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()[header::CONTENT_TYPE], "image/png");
        assert_eq!(response.body(), b"\x89PNG fake");
        // A new cover changes the URL, so the WebView cache never shows the old one.
        let other = format!(
            "data:image/png;base64,{}",
            STANDARD.encode(b"\x89PNG other")
        );
        connection
            .execute("UPDATE stash_items SET preview=?1", [&other])
            .unwrap();
        assert_ne!(
            for_webview(read_items(&connection).unwrap())[0]
                .preview
                .as_ref()
                .unwrap(),
            &link
        );
        // Remote cover URLs are left as they are; unknown IDs are not found.
        let missing = Request::builder()
            .uri(format!("{SCHEME}://localhost/missing"))
            .body(Vec::new())
            .unwrap();
        assert_eq!(respond(&database, &missing).status(), StatusCode::NOT_FOUND);
        drop(connection);
        let _ = fs::remove_dir_all(root);
    }
}
