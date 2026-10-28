use super::{
    delete_item_by_id, import_extension_items, ExtensionImportRequest, ExtensionImportResult,
};
use rusqlite::Connection;
use std::{
    io::Read,
    path::{Path, PathBuf},
    thread,
};
use tauri::{AppHandle, Emitter};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

const EXTENSION_SERVER_ADDRESS: &str = "127.0.0.1:17863";
const EXTENSION_BODY_LIMIT: u64 = 4 * 1024 * 1024;

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct CardPatch {
    title: Option<String>,
    tags: Option<Vec<String>>,
    favorite: Option<bool>,
}

pub(super) fn apply_browser_card_patch(
    connection: &mut Connection,
    id: &str,
    body: &str,
) -> Result<(), String> {
    let value: serde_json::Value =
        serde_json::from_str(body).map_err(|_| "Invalid card edit.".to_string())?;
    let mut keys: Vec<_> = value
        .as_object()
        .ok_or("Invalid card edit.")?
        .keys()
        .map(String::as_str)
        .collect();
    keys.sort_unstable();
    if keys != ["favorite"] && keys != ["tags", "title"] {
        return Err("Only title/tags or favorite may be edited from the browser.".into());
    }
    let patch: CardPatch =
        serde_json::from_str(body).map_err(|_| "Invalid card edit.".to_string())?;
    let transaction = connection
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|e| e.to_string())?;
    match (patch.title, patch.tags, patch.favorite) {
        (Some(title), Some(tags), None) => super::edit_metadata(&transaction, id, &title, tags)?,
        (None, None, Some(favorite)) => super::update_favorite(&transaction, id, favorite)?,
        _ => return Err("Only title/tags or favorite may be edited from the browser.".into()),
    }
    transaction.commit().map_err(|e| e.to_string())
}

fn request_header(request: &Request, name: &'static str) -> Option<String> {
    request
        .headers()
        .iter()
        .find(|header| header.field.equiv(name))
        .map(|header| header.value.as_str().to_string())
}

fn request_origin(request: &Request) -> Option<String> {
    request_header(request, "Origin")
}

fn extension_origin_allowed(origin: &str) -> bool {
    origin.starts_with("chrome-extension://")
        || origin.starts_with("moz-extension://")
        || crate::integrations::safari_native_origin(origin)
        || crate::native_messaging::trusted_origin(origin)
}

pub(super) fn json_response(
    body: impl Into<String>,
    status: u16,
    origin: Option<&str>,
) -> Response<std::io::Cursor<Vec<u8>>> {
    let mut response = Response::from_string(body.into()).with_status_code(StatusCode(status));
    response
        .add_header(Header::from_bytes("Content-Type", "application/json; charset=utf-8").unwrap());
    response.add_header(Header::from_bytes("Cache-Control", "no-store").unwrap());
    if let Some(origin) = origin {
        response.add_header(Header::from_bytes("Access-Control-Allow-Origin", origin).unwrap());
        response.add_header(Header::from_bytes("Vary", "Origin").unwrap());
        response.add_header(
            Header::from_bytes(
                "Access-Control-Allow-Methods",
                "GET, POST, PATCH, DELETE, OPTIONS",
            )
            .unwrap(),
        );
        response.add_header(
            Header::from_bytes(
                "Access-Control-Allow-Headers",
                "Content-Type, X-StashDock-Client",
            )
            .unwrap(),
        );
        response.add_header(
            Header::from_bytes("Access-Control-Allow-Private-Network", "true").unwrap(),
        );
    }
    response
}

type Notify<'a> = dyn Fn(&str, serde_json::Value) + 'a;

fn handle_extension_request(mut request: Request, database_path: &Path, notify: &Notify<'_>) {
    let origin = request_origin(&request);
    let allowed_origin = origin
        .as_deref()
        .filter(|value| extension_origin_allowed(value));
    let client_header = request_header(&request, "X-StashDock-Client");
    let has_extension_client_header = client_header.as_deref() == Some("chrome-extension-v1");
    let registered_origin = allowed_origin.is_some_and(|origin| {
        Connection::open(database_path)
            .ok()
            .is_some_and(|db| crate::integrations::browser_origin_allowed(&db, origin))
    });
    let trusted_extension_request = registered_origin && has_extension_client_header;
    let setup_request = allowed_origin.is_some() && has_extension_client_header;
    let trusted_read_request = trusted_extension_request;
    let path = request
        .url()
        .split('?')
        .next()
        .unwrap_or_default()
        .to_owned();

    if (path == "/v1/capture" && matches!(request.method(), &Method::Get | &Method::Post))
        || (path == "/v1/capture/lookup" && request.method() == &Method::Post)
    {
        if !trusted_extension_request || !has_extension_client_header {
            let _ = request.respond(json_response(
                r#"{"error":"An extension request is required."}"#,
                403,
                None,
            ));
            return;
        }
        let result = (|| -> Result<serde_json::Value, String> {
            let mut connection = Connection::open(database_path).map_err(|e| e.to_string())?;
            connection
                .busy_timeout(std::time::Duration::from_secs(3))
                .map_err(|e| e.to_string())?;
            if path == "/v1/capture/lookup" && request.method() == &Method::Post {
                if !request_header(&request, "Content-Type")
                    .is_some_and(|v| v.starts_with("application/json"))
                {
                    return Err("Use a JSON request.".into());
                }
                let mut body = String::new();
                request
                    .as_reader()
                    .take(16385)
                    .read_to_string(&mut body)
                    .map_err(|e| e.to_string())?;
                if body.len() > 16384 {
                    return Err("Invalid lookup request.".into());
                }
                #[derive(serde::Deserialize)]
                #[serde(rename_all = "camelCase", deny_unknown_fields)]
                struct Lookup {
                    url: String,
                    operation_id: Option<String>,
                    digest: Option<String>,
                }
                let input: Lookup =
                    serde_json::from_str(&body).map_err(|_| "Invalid lookup request.")?;
                if input.url.len() > 8000 {
                    return Err("Invalid URL.".into());
                }
                return super::browser_capture::lookup(
                    &connection,
                    &input.url,
                    input.operation_id.as_deref(),
                    input.digest.as_deref(),
                );
            }
            if request.method() == &Method::Get && path == "/v1/capture" {
                let url = url::Url::parse(&format!("http://localhost{}", request.url()))
                    .map_err(|_| "Invalid URL.")?;
                let raw = url
                    .query_pairs()
                    .find(|(key, _)| key == "url")
                    .map(|(_, value)| value.into_owned())
                    .ok_or("Invalid URL.")?;
                if raw.len() > 8000 {
                    return Err("Invalid URL.".into());
                }
                let operation = url
                    .query_pairs()
                    .find(|(key, _)| key == "operationId")
                    .map(|(_, v)| v.into_owned());
                let digest = url
                    .query_pairs()
                    .find(|(key, _)| key == "digest")
                    .map(|(_, v)| v.into_owned());
                return super::browser_capture::lookup(
                    &connection,
                    &raw,
                    operation.as_deref(),
                    digest.as_deref(),
                );
            }
            if !request_header(&request, "Content-Type")
                .is_some_and(|v| v.starts_with("application/json"))
            {
                return Err("Use a JSON request.".into());
            }
            let mut body = String::new();
            request
                .as_reader()
                .take(1_000_001)
                .read_to_string(&mut body)
                .map_err(|e| e.to_string())?;
            if body.len() > 1_000_000 {
                return Err("Page capture is too large.".into());
            }
            super::browser_capture::save(&mut connection, &body)
        })();
        let response = match result {
            Ok(value) => {
                if value["saved"] == true {
                    notify("extension-imported", serde_json::json!({"updated":1}));
                }
                json_response(value.to_string(), 200, allowed_origin)
            }
            Err(error) => json_response(
                serde_json::json!({"error":error}).to_string(),
                400,
                allowed_origin,
            ),
        };
        let _ = request.respond(response);
        return;
    }

    if request.method() == &Method::Options {
        let response = if allowed_origin.is_some() {
            json_response("{}", 204, allowed_origin)
        } else {
            json_response(r#"{"error":"Extension origin required."}"#, 403, None)
        };
        let _ = request.respond(response);
        return;
    }

    if request.method() == &Method::Get && path == "/v1/health" {
        let response = if origin.is_none() || allowed_origin.is_some() {
            json_response(
                r#"{"ok":true,"name":"StashDock","apiVersion":1}"#,
                200,
                allowed_origin,
            )
        } else {
            json_response(r#"{"error":"Extension origin required."}"#, 403, None)
        };
        let _ = request.respond(response);
        return;
    }

    if request.method() == &Method::Post && path == "/v1/setup" {
        if !setup_request
            || !request_header(&request, "Content-Type")
                .is_some_and(|v| v.starts_with("application/json"))
        {
            let _ = request.respond(json_response(
                r#"{"error":"An extension request is required."}"#,
                403,
                allowed_origin,
            ));
            return;
        }
        let result = (|| -> Result<String, String> {
            let mut body = String::new();
            request
                .as_reader()
                .take(4097)
                .read_to_string(&mut body)
                .map_err(|e| e.to_string())?;
            if body.len() > 4096 {
                return Err("Invalid setup request.".into());
            }
            let value: serde_json::Value =
                serde_json::from_str(&body).map_err(|_| "Invalid setup request.")?;
            let browser = value["browser"].as_str().ok_or("Invalid browser.")?;
            let version = value["version"].as_str().ok_or("Invalid version.")?;
            let db = Connection::open(database_path).map_err(|e| e.to_string())?;
            db.busy_timeout(std::time::Duration::from_secs(3))
                .map_err(|e| e.to_string())?;
            let extension_id = crate::integrations::browser_registration(
                browser,
                allowed_origin,
                value["extensionId"].as_str(),
            )?;
            crate::integrations::record_browser_origin(
                &db,
                browser,
                version,
                extension_id
                    .as_deref()
                    .ok_or("Invalid StashDock extension.")?,
                allowed_origin.ok_or("Invalid StashDock extension.")?,
            )?;
            // Connection acknowledgement never scans unrelated applications or
            // waits for SafariServices. Settings queries presence separately.
            Ok(
                serde_json::json!({"connected":true,"owner":"desktop","integrations":{"items":[]}})
                    .to_string(),
            )
        })();
        let response = match result {
            Ok(value) => json_response(value, 200, allowed_origin),
            Err(error) => json_response(
                serde_json::json!({"error":error}).to_string(),
                400,
                allowed_origin,
            ),
        };
        let _ = request.respond(response);
        return;
    }

    if request.method() == &Method::Post && path == "/v1/open-integration" {
        if !trusted_extension_request
            || !has_extension_client_header
            || !request_header(&request, "Content-Type")
                .is_some_and(|v| v.starts_with("application/json"))
        {
            let _ = request.respond(json_response(
                r#"{"error":"An extension request is required."}"#,
                403,
                allowed_origin,
            ));
            return;
        }
        let result = (|| -> Result<(), String> {
            let mut body = String::new();
            request
                .as_reader()
                .take(1025)
                .read_to_string(&mut body)
                .map_err(|e| e.to_string())?;
            if body.len() > 1024 {
                return Err("Invalid application request.".into());
            }
            #[derive(serde::Deserialize)]
            #[serde(deny_unknown_fields)]
            struct Input {
                id: String,
            }
            let input: Input =
                serde_json::from_str(&body).map_err(|_| "Invalid application request.")?;
            let db = Connection::open(database_path).map_err(|e| e.to_string())?;
            crate::integration_launch::launch(
                &input.id,
                crate::integration_launch::registered_desktop(&db),
            )
        })();
        let response = match result {
            Ok(()) => json_response(r#"{"opened":true}"#, 200, allowed_origin),
            Err(error) => json_response(
                serde_json::json!({"error":error}).to_string(),
                400,
                allowed_origin,
            ),
        };
        let _ = request.respond(response);
        return;
    }
    if matches!(request.method(), &Method::Get | &Method::Post) && path == "/v1/tags" {
        if !trusted_read_request {
            let _ = request.respond(json_response(
                r#"{"error":"A trusted StashDock client is required."}"#,
                403,
                None,
            ));
            return;
        }
        let result = (|| -> Result<String, String> {
            let connection = Connection::open(database_path).map_err(|e| e.to_string())?;
            connection
                .busy_timeout(std::time::Duration::from_secs(3))
                .map_err(|e| e.to_string())?;
            Ok(super::browser_capture::tags(&connection)?.to_string())
        })();
        let response = match result {
            Ok(body) => json_response(body, 200, allowed_origin),
            Err(error) => json_response(
                serde_json::json!({"error":error}).to_string(),
                500,
                allowed_origin,
            ),
        };
        let _ = request.respond(response);
        return;
    }

    if request.method() == &Method::Patch {
        let id = path
            .strip_prefix("/v1/items/")
            .unwrap_or_default()
            .to_string();
        if !trusted_extension_request
            || id.is_empty()
            || id.len() > 120
            || !id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        {
            let _ = request.respond(json_response(
                r#"{"error":"A browser extension and valid reference ID are required."}"#,
                403,
                None,
            ));
            return;
        }
        let result = (|| -> Result<(), String> {
            if !request_header(&request, "Content-Type")
                .unwrap_or_default()
                .starts_with("application/json")
            {
                return Err("Use a JSON request.".into());
            }
            let mut body = String::new();
            request
                .as_reader()
                .take(16_001)
                .read_to_string(&mut body)
                .map_err(|e| e.to_string())?;
            if body.len() > 16_000 {
                return Err("Card edit is too large.".into());
            }
            let mut connection = Connection::open(database_path).map_err(|e| e.to_string())?;
            connection
                .busy_timeout(std::time::Duration::from_secs(3))
                .map_err(|e| e.to_string())?;
            apply_browser_card_patch(&mut connection, &id, &body)
        })();
        let response = match result {
            Ok(()) => {
                notify("extension-imported", serde_json::json!({"updated":1}));
                json_response(r#"{"updated":true}"#, 200, allowed_origin)
            }
            Err(error) => json_response(
                serde_json::json!({"error":error}).to_string(),
                400,
                allowed_origin,
            ),
        };
        let _ = request.respond(response);
        return;
    }
    if request.method() == &Method::Delete {
        let Some(id) = path.strip_prefix("/v1/items/") else {
            let _ = request.respond(json_response(
                r#"{"error":"Not found."}"#,
                404,
                allowed_origin,
            ));
            return;
        };
        let valid_id = !id.is_empty()
            && id.len() <= 120
            && id.chars().all(|character| {
                character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
            });
        if !trusted_extension_request || !valid_id {
            let _ = request.respond(json_response(
                r#"{"error":"Only a browser extension may delete a valid item."}"#,
                403,
                None,
            ));
            return;
        }
        let result = (|| -> Result<bool, String> {
            let mut connection =
                Connection::open(database_path).map_err(|error| error.to_string())?;
            connection
                .busy_timeout(std::time::Duration::from_secs(3))
                .map_err(|error| error.to_string())?;
            delete_item_by_id(&mut connection, id)
        })();
        let response = match result {
            Ok(deleted) => {
                if deleted {
                    notify("extension-deleted", serde_json::json!({ "id": id }));
                }
                json_response(
                    serde_json::json!({ "deleted": deleted }).to_string(),
                    200,
                    allowed_origin,
                )
            }
            Err(error) => json_response(
                serde_json::json!({ "error": error }).to_string(),
                500,
                allowed_origin,
            ),
        };
        let _ = request.respond(response);
        return;
    }

    if request.method() != &Method::Post || path != "/v1/import" {
        let _ = request.respond(json_response(
            r#"{"error":"Not found."}"#,
            404,
            allowed_origin,
        ));
        return;
    }
    if !trusted_extension_request {
        let _ = request.respond(json_response(
            r#"{"error":"Only a browser extension may import items."}"#,
            403,
            None,
        ));
        return;
    }

    let mut body = String::new();
    let read_result = request
        .as_reader()
        .take(EXTENSION_BODY_LIMIT + 1)
        .read_to_string(&mut body);
    let result = (|| -> Result<ExtensionImportResult, String> {
        read_result.map_err(|error| error.to_string())?;
        if body.len() as u64 > EXTENSION_BODY_LIMIT {
            return Err("The extension payload is too large.".to_string());
        }
        let payload: ExtensionImportRequest = serde_json::from_str(&body)
            .map_err(|_| "The extension payload is invalid.".to_string())?;
        let mut connection = Connection::open(database_path).map_err(|error| error.to_string())?;
        connection
            .busy_timeout(std::time::Duration::from_secs(3))
            .map_err(|error| error.to_string())?;
        import_extension_items(&mut connection, payload.items)
    })();

    match result {
        Ok(summary) => {
            notify("extension-imported", serde_json::json!(summary));
            let body = serde_json::to_string(&summary).unwrap_or_else(|_| "{}".to_string());
            let _ = request.respond(json_response(body, 200, allowed_origin));
        }
        Err(error) => {
            let body = serde_json::json!({ "error": error }).to_string();
            let _ = request.respond(json_response(body, 400, allowed_origin));
        }
    }
}

/// Requests are served by a few threads so one slow request (for example a
/// large save) does not hold up the extension's other requests. If the port is
/// taken (the AI plugin's bridge may hold it), keep retrying like that bridge
/// does instead of giving up for the whole session.
pub fn start_extension_server(app: AppHandle, database_path: PathBuf) {
    thread::spawn(move || {
        let server = loop {
            match Server::http(EXTENSION_SERVER_ADDRESS) {
                Ok(server) => break std::sync::Arc::new(server),
                Err(_) => thread::sleep(std::time::Duration::from_secs(5)),
            }
        };
        for _ in 0..BRIDGE_WORKERS {
            let (server, app, database_path) = (server.clone(), app.clone(), database_path.clone());
            thread::spawn(move || {
                let notify = move |event: &str, payload: serde_json::Value| {
                    let _ = app.emit(event, payload);
                };
                for request in server.incoming_requests() {
                    serve(request, &database_path, &notify);
                }
            });
        }
    });
}
const BRIDGE_WORKERS: usize = 4;

/// Only requests addressed to this loopback server are served, which blocks
/// DNS-rebinding pages (same check as the plugin's capture bridge).
fn host_allowed(host: Option<&str>) -> bool {
    let port = EXTENSION_SERVER_ADDRESS
        .rsplit(':')
        .next()
        .unwrap_or_default();
    host.is_some_and(|host| {
        host == format!("127.0.0.1:{port}") || host == format!("localhost:{port}")
    })
}

fn serve(request: Request, database_path: &Path, notify: &Notify<'_>) {
    if !host_allowed(request_header(&request, "Host").as_deref()) {
        let _ = request.respond(json_response(r#"{"error":"Forbidden host."}"#, 403, None));
        return;
    }
    let location = database_path
        .parent()
        .ok_or_else(|| "The library location is unavailable.".to_string())
        .and_then(crate::library_location::resolve);
    match location {
        Ok(root) => handle_extension_request(request, &root.join("stashdock.sqlite3"), notify),
        Err(error) => {
            let origin = request_origin(&request).filter(|value| extension_origin_allowed(value));
            let _ = request.respond(json_response(
                serde_json::json!({ "error": error }).to_string(),
                503,
                origin.as_deref(),
            ));
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn real_http_capture_requires_confirmation_and_notifies_after_commit() {
        use super::*;
        use serde_json::json;
        let root = std::env::temp_dir().join(format!("stashdock-wire-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let database = root.join("stashdock.sqlite3");
        let db = Connection::open(&database).unwrap();
        super::super::initialize_schema(&db).unwrap();
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../../product-links.json")).unwrap();
        let id = config["browserExtensions"]["edge"]["id"].as_str().unwrap();
        let origin = format!("chrome-extension://{id}");
        let server = Server::http("127.0.0.1:0").unwrap();
        let address = format!("http://{}", server.server_addr());
        let path = database.clone();
        let task = thread::spawn(move || {
            let changes = std::cell::RefCell::new(Vec::new());
            for _ in 0..8 {
                let request = server
                    .recv_timeout(std::time::Duration::from_secs(3))
                    .unwrap()
                    .unwrap();
                serve(request, &path, &|event, payload| {
                    // The receiving observer can already read the committed row.
                    let connection = Connection::open(&path).unwrap();
                    let title: String = connection
                        .query_row("SELECT title FROM stash_items LIMIT 1", [], |row| {
                            row.get(0)
                        })
                        .unwrap();
                    changes
                        .borrow_mut()
                        .push((event.to_owned(), payload, title));
                });
            }
            changes.into_inner()
        });
        let client = reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(std::time::Duration::from_secs(3))
            .build()
            .unwrap();
        let post = |path: &str, body: serde_json::Value| {
            client
                .post(format!("{address}{path}"))
                .header("Host", "127.0.0.1:17863")
                .header("Origin", &origin)
                .header("X-StashDock-Client", "chrome-extension-v1")
                .json(&body)
                .send()
                .unwrap()
                .json::<serde_json::Value>()
                .unwrap()
        };
        let item = json!({"id":"draft","title":"First wire title","kind":"web","source":"Example","url":"https://example.org/wire","excerpt":"Body","content":"Wire body","tags":[],"createdAt":"2026-10-25T00:00:00Z"});
        assert_eq!(
            post("/v1/capture/lookup", json!({"url":item["url"]}))["error"],
            "An extension request is required."
        );
        let setup = post(
            "/v1/setup",
            json!({"browser":"edge","version":"0.4.17","extensionId":id}),
        );
        assert_eq!(setup["connected"], true);
        assert_eq!(setup["integrations"]["items"], json!([]));
        assert!(post("/v1/capture/lookup", json!({"url":item["url"]}))["duplicate"].is_null());
        assert_eq!(
            post(
                "/v1/capture",
                json!({"item":item,"operationId":"wire-first-save-1234"})
            )["saved"],
            true
        );
        let duplicate = post("/v1/capture/lookup", json!({"url":item["url"]}))["duplicate"].clone();
        let mut changed = item.clone();
        changed["title"] = json!("Confirmed wire replacement");
        let request = json!({"item":changed,"operationId":"wire-replacement-1234"});
        assert_eq!(post("/v1/capture", request.clone())["duplicate"], duplicate);
        assert_eq!(
            db.query_row("SELECT title FROM stash_items", [], |row| row
                .get::<_, String>(0))
                .unwrap(),
            "First wire title"
        );
        let mut confirmed = request;
        confirmed["replace"] = duplicate;
        assert_eq!(post("/v1/capture", confirmed)["saved"], true);
        let rejected = client
            .post(format!("{address}/v1/capture"))
            .header("Host", "127.0.0.1:17863")
            .header("Origin", "https://example.org")
            .header("X-StashDock-Client", "chrome-extension-v1")
            .json(&json!({"item":item}))
            .send()
            .unwrap();
        assert_eq!(rejected.status(), 403);
        let changes = task.join().unwrap();
        assert_eq!(changes.len(), 2);
        assert_eq!(changes[0].2, "First wire title");
        assert_eq!(changes[1].2, "Confirmed wire replacement");
        assert_eq!(
            db.query_row("SELECT COUNT(*) FROM stash_items", [], |row| row
                .get::<_, i64>(0))
                .unwrap(),
            1
        );
        drop(db);
        std::fs::remove_dir_all(root).unwrap();
    }

    // Operator-run acceptance server. This is compiled only into the test
    // executable; the shipped Desktop has no test port or data-routing switch.
    #[test]
    #[ignore = "owned real-browser acceptance; requires a fresh temporary QA directory"]
    fn isolated_browser_acceptance_server() {
        use super::*;
        use std::{
            fs,
            io::Write,
            time::{Duration, Instant},
        };
        let root = PathBuf::from(
            std::env::var_os("STASHDOCK_BRIDGE_QA_DIRECTORY")
                .expect("Explicit QA directory required"),
        );
        assert!(root.starts_with(std::env::temp_dir()));
        assert!(root
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("stashdock-native-bridge-qa-"));
        assert!(root.join("ISOLATED_QA").is_file());
        let database = root.join("stashdock.sqlite3");
        let db = Connection::open(&database).unwrap();
        super::super::initialize_schema(&db).unwrap();
        drop(db);
        let server = Server::http(EXTENSION_SERVER_ADDRESS)
            .expect("Close only the known Desktop provider before starting QA");
        fs::write(
            root.join("ready.json"),
            serde_json::json!({"address":EXTENSION_SERVER_ADDRESS,"database":database}).to_string(),
        )
        .unwrap();
        let deadline = Instant::now() + Duration::from_secs(600);
        while !root.join("STOP").exists() && Instant::now() < deadline {
            if let Some(request) = server.recv_timeout(Duration::from_millis(100)).unwrap() {
                serve(request, &database, &|event, payload| {
                    let mut log = fs::OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(root.join("events.jsonl"))
                        .unwrap();
                    writeln!(
                        log,
                        "{}",
                        serde_json::json!({"event":event,"payload":payload})
                    )
                    .unwrap();
                });
            }
        }
    }

    #[test]
    fn only_requests_addressed_to_the_loopback_bridge_are_served() {
        assert!(super::host_allowed(Some("127.0.0.1:17863")));
        assert!(super::host_allowed(Some("localhost:17863")));
        for host in [
            None,
            Some("evil.example:17863"),
            Some("127.0.0.1"),
            Some("localhost:5173"),
        ] {
            assert!(!super::host_allowed(host), "{host:?}");
        }
    }
}
