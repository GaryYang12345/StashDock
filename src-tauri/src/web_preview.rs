//! A persistent, single-consumer enrichment queue. Network and rendering work
//! never hold a library lock, and completion only merges image fields by id + URL.
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

pub struct WebPreviewWorker {
    stop: Arc<AtomicBool>,
}
impl Drop for WebPreviewWorker {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
    }
}
pub fn stop(app: &AppHandle) {
    if let Some(worker) = app.try_state::<WebPreviewWorker>() {
        worker.stop.store(true, Ordering::Relaxed);
    }
}
fn timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
// Read-time metadata only. Never persist transient UI state into user records.
pub(crate) fn annotate(
    db: &Connection,
    items: &mut [crate::library::StashItem],
) -> rusqlite::Result<()> {
    for item in items.iter_mut() {
        item.preview_status = None;
    }
    let live = db
        .query_row(
            "SELECT CAST(value AS INTEGER) FROM app_meta WHERE key='web_preview_worker_until'",
            [],
            |r| r.get::<_, i64>(0),
        )
        .optional()?
        .is_some_and(|until| until > timestamp());
    if !live {
        return Ok(());
    }
    let mut query = db.prepare("SELECT status FROM web_preview_jobs WHERE id=?1 AND url=?2")?;
    for item in items {
        if !matches!(item.kind.as_str(), "web" | "repo")
            || item.preview.as_ref().is_some_and(|s| !s.is_empty())
        {
            continue;
        }
        let Some(url) = item
            .url
            .as_deref()
            .filter(|url| crate::public_web::web_url(url).is_ok())
        else {
            continue;
        };
        let status = query
            .query_row(params![item.id, url], |r| r.get::<_, String>(0))
            .optional()?;
        item.preview_status = Some(
            match status.as_deref() {
                None => "queued",
                Some("working") => "working",
                Some("failed") => "failed",
                _ => "unavailable",
            }
            .into(),
        );
    }
    Ok(())
}
fn heartbeat(db: &Connection, owner: &str) -> rusqlite::Result<bool> {
    // A lease is not a heartbeat log. Reads suffice until renewal is due;
    // inactive providers must not acquire a writer lock every queue tick.
    let (current, until, relocated): (Option<String>, i64, bool) = db.query_row(
        "SELECT (SELECT value FROM app_meta WHERE key='web_preview_worker_owner'),COALESCE((SELECT CAST(value AS INTEGER) FROM app_meta WHERE key='web_preview_worker_until'),0),EXISTS(SELECT 1 FROM app_meta WHERE key=?1)",
        [crate::library_location::REDIRECT_KEY], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?;
    if relocated {
        return Ok(false);
    }
    if until > timestamp() {
        if current.as_deref() != Some(owner) {
            return Ok(false);
        }
        if until > timestamp() + 60 {
            return Ok(true);
        }
    }
    let tx = rusqlite::Transaction::new_unchecked(db, rusqlite::TransactionBehavior::Immediate)?;
    if tx
        .query_row(
            "SELECT 1 FROM app_meta WHERE key=?1",
            [crate::library_location::REDIRECT_KEY],
            |_| Ok(()),
        )
        .optional()?
        .is_some()
    {
        return Ok(false);
    }
    let until = tx
        .query_row(
            "SELECT CAST(value AS INTEGER) FROM app_meta WHERE key='web_preview_worker_until'",
            [],
            |r| r.get::<_, i64>(0),
        )
        .optional()?
        .unwrap_or(0);
    let current = tx
        .query_row(
            "SELECT value FROM app_meta WHERE key='web_preview_worker_owner'",
            [],
            |r| r.get::<_, String>(0),
        )
        .optional()?;
    if until > timestamp() && current.as_deref() != Some(owner) {
        return Ok(false);
    }
    tx.execute("INSERT INTO app_meta(key,value) VALUES('web_preview_worker_owner',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [owner])?;
    tx.execute("INSERT INTO app_meta(key,value) VALUES('web_preview_worker_until',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [(timestamp()+90).to_string()])?;
    tx.commit()?;
    Ok(true)
}
fn schema(db: &Connection) -> rusqlite::Result<()> {
    db.execute_batch("PRAGMA busy_timeout=1000; PRAGMA foreign_keys=ON;
        CREATE TABLE IF NOT EXISTS web_preview_jobs (
            id TEXT PRIMARY KEY REFERENCES stash_items(id) ON DELETE CASCADE,
            url TEXT NOT NULL, attempts INTEGER NOT NULL, retry_at INTEGER NOT NULL, status TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS web_favicon_cache (
            url TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL
        );")?;
    // A repaired/new bundled engine must retry old exhausted failures once,
    // not require users to re-import references or erase their saved edits.
    if let Some(version) = crate::preview_browser::runtime_version() {
        let tx =
            rusqlite::Transaction::new_unchecked(db, rusqlite::TransactionBehavior::Immediate)?;
        let prior = tx
            .query_row(
                "SELECT value FROM app_meta WHERE key='web_preview_runtime_version'",
                [],
                |r| r.get::<_, String>(0),
            )
            .optional()?;
        if prior.as_deref() != Some(version.as_str()) {
            tx.execute("UPDATE web_preview_jobs SET attempts=0,retry_at=0,status='failed' WHERE status IN ('failed','done') AND id IN (SELECT id FROM stash_items WHERE preview IS NULL OR preview='' OR COALESCE(json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.faviconUrl'),'') NOT LIKE 'data:image/%')", [])?;
            tx.execute("INSERT INTO app_meta VALUES('web_preview_runtime_version',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [&version])?;
        }
        tx.commit()?;
    }
    Ok(())
}
struct Job {
    id: String,
    url: String,
    needs_preview: bool,
    favicon: Option<String>,
}
fn next_job(db: &Connection) -> rusqlite::Result<Option<Job>> {
    db.query_row("SELECT s.id, s.url, s.preview, s.origin_json FROM stash_items s
        LEFT JOIN web_preview_jobs j ON j.id=s.id AND j.url=s.url
        WHERE s.kind IN ('web','repo') AND s.url IS NOT NULL
          AND (s.preview IS NULL OR s.preview='' OR COALESCE(json_extract(CASE WHEN json_valid(s.origin_json) THEN s.origin_json ELSE '{}' END, '$.faviconUrl'),'') NOT LIKE 'data:image/%')
          AND (j.id IS NULL OR (j.status != 'done' AND j.attempts < 3 AND j.retry_at <= ?1))
        ORDER BY s.created_at DESC LIMIT 1", [timestamp()], |row| {
            let origin: Option<String> = row.get(3)?;
            let favicon = origin.and_then(|value| serde_json::from_str::<Value>(&value).ok()).and_then(|origin| origin["faviconUrl"].as_str().map(str::to_string));
            let preview: Option<String> = row.get(2)?;
            Ok(Job { id: row.get(0)?, url: row.get(1)?, needs_preview: preview.as_ref().is_none_or(|value| value.is_empty()), favicon })
        }).optional()
}
fn claim(db: &Connection, job: &Job) -> rusqlite::Result<()> {
    db.execute("INSERT INTO web_preview_jobs(id,url,attempts,retry_at,status) VALUES(?1,?2,1,?3,'working')
        ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN web_preview_jobs.url=excluded.url THEN web_preview_jobs.attempts+1 ELSE 1 END,
        url=excluded.url,retry_at=excluded.retry_at,status='working'", params![job.id, job.url, timestamp()+60])?;
    Ok(())
}
// No stale full-item upsert: preserve content, context overrides, tags, stars and other metadata.
fn merge(
    db: &mut Connection,
    job: &Job,
    preview: Option<&str>,
    kind: Option<&str>,
    favicon: Option<&str>,
) -> rusqlite::Result<bool> {
    let tx = db.transaction()?;
    let latest = tx
        .query_row(
            "SELECT origin_json,preview FROM stash_items WHERE id=?1 AND url=?2",
            params![job.id, job.url],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                ))
            },
        )
        .optional()?;
    let Some((raw, old_preview)) = latest else {
        return Ok(false);
    };
    let mut origin = raw
        .as_deref()
        .and_then(|value| serde_json::from_str::<Value>(value).ok())
        .filter(Value::is_object)
        .unwrap_or_else(|| json!({}));
    let current_icon = origin["faviconUrl"].as_str();
    let icon_changed =
        favicon.is_some() && (current_icon.is_none() || current_icon == job.favicon.as_deref());
    if icon_changed {
        origin["faviconUrl"] = json!(favicon);
    }
    let preview_changed =
        preview.is_some() && old_preview.as_ref().is_none_or(|value| value.is_empty());
    if preview_changed {
        origin["previewKind"] = json!(kind);
    }
    if icon_changed || preview_changed {
        tx.execute("UPDATE stash_items SET preview=COALESCE(NULLIF(preview,''),?1),origin_json=?2 WHERE id=?3 AND url=?4",
            params![preview, origin.to_string(), job.id, job.url])?;
    }
    tx.commit()?;
    Ok(icon_changed || preview_changed)
}
fn finish(db: &Connection, job: &Job, success: bool) -> rusqlite::Result<()> {
    db.execute(
        "UPDATE web_preview_jobs SET status=?1,retry_at=?2 WHERE id=?3 AND url=?4",
        params![
            if success { "done" } else { "failed" },
            timestamp() + 600,
            job.id,
            job.url
        ],
    )?;
    Ok(())
}
fn enrich(
    db: &mut Connection,
    job: &Job,
    stop: &AtomicBool,
    changed: &impl Fn(),
    _root: &std::path::Path,
) -> bool {
    let Ok(url) = crate::public_web::web_url(&job.url) else {
        return true;
    };
    if crate::public_web::resolve_public(
        url.host_str().unwrap(),
        url.port_or_known_default().unwrap(),
    )
    .is_err()
    {
        return false;
    }
    let metadata =
        crate::link_metadata::fetch_preview_with_images(&job.url, job.needs_preview).ok();
    if stop.load(Ordering::Relaxed) {
        return false;
    }
    let mut favicon = job
        .favicon
        .as_ref()
        .filter(|value| value.starts_with("data:image/"))
        .cloned()
        .or_else(|| {
            metadata
                .as_ref()?
                .favicon_url
                .as_ref()
                .filter(|s| s.starts_with("data:image/"))
                .cloned()
        });
    if favicon.is_none() {
        let deadline = Instant::now() + Duration::from_secs(6);
        let mut candidates = Vec::new();
        if let Some(value) = metadata.as_ref().and_then(|data| data.favicon_url.as_ref()) {
            candidates.push(value.clone());
        }
        if let Some(value) = &job.favicon {
            if !candidates.contains(value) {
                candidates.push(value.clone());
            }
        }
        for path in [
            "/favicon.ico",
            "/favicon.svg",
            "/favicon.png",
            "/apple-touch-icon.png",
        ] {
            if let Ok(value) = url.join(path) {
                candidates.push(value.into());
            }
        }
        for candidate in candidates.into_iter().take(6) {
            if stop.load(Ordering::Relaxed) || Instant::now() >= deadline {
                break;
            }
            let cached = db
                .query_row(
                    "SELECT data FROM web_favicon_cache WHERE url=?1",
                    [&candidate],
                    |row| row.get::<_, String>(0),
                )
                .optional()
                .ok()
                .flatten();
            if let Some(data) = cached {
                favicon = Some(data);
                break;
            }
            if let Ok(data) = crate::web_images::download(&candidate, true, deadline) {
                let _ = db.execute("INSERT INTO web_favicon_cache(url,data,updated_at) VALUES(?1,?2,?3) ON CONFLICT(url) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at", params![candidate,data,timestamp()]);
                let _ = db.execute("DELETE FROM web_favicon_cache WHERE url IN (SELECT url FROM web_favicon_cache ORDER BY updated_at DESC LIMIT -1 OFFSET 1024)", []);
                favicon = Some(data);
                break;
            }
        }
    }
    // Metadata already returns a normalized icon. Persist it for icon-only jobs too.
    if let Some(icon) = &favicon {
        if merge(db, job, None, None, Some(icon)).unwrap_or(false) {
            changed();
        }
    }
    if stop.load(Ordering::Relaxed) {
        return false;
    }
    if !job.needs_preview {
        return favicon.is_some();
    }
    let mut kind = metadata
        .as_ref()
        .and_then(|data| data.preview_kind.as_deref())
        .unwrap_or("screenshot");
    let preview = metadata
        .as_ref()
        .and_then(|data| data.preview.clone())
        .or_else(|| crate::preview_cache::capture(&job.url, stop).ok())
        .or_else(|| {
            if stop.load(Ordering::Relaxed) {
                return None;
            }
            kind = "cover";
            metadata
                .as_ref()
                .and_then(|data| data.cover_url.as_ref())
                .and_then(|url| {
                    crate::web_images::download(url, false, Instant::now() + Duration::from_secs(5))
                        .ok()
                })
        });
    if let Some(data) = &preview {
        if merge(db, job, Some(data), Some(kind), favicon.as_deref()).unwrap_or(false) {
            changed();
        }
    }
    preview.is_some() && favicon.is_some()
}
pub fn start(app: AppHandle, database_path: PathBuf) {
    let stop = Arc::new(AtomicBool::new(false));
    app.manage(WebPreviewWorker { stop: stop.clone() });
    thread::spawn(move || {
        let Some(root) = database_path.parent().map(std::path::Path::to_path_buf) else {
            return;
        };
        let Ok(mut db) = Connection::open(database_path) else {
            return;
        };
        if schema(&db).is_err() {
            return;
        }
        let owner = uuid::Uuid::new_v4().to_string();
        let mut empty_version = None;
        let mut next_scan = Instant::now();
        while !stop.load(Ordering::Relaxed) {
            if !heartbeat(&db, &owner).unwrap_or(false) {
                // Another provider owns enrichment. Check takeover infrequently,
                // without another idle thread or any database writes.
                for _ in 0..150 {
                    if stop.load(Ordering::Relaxed) {
                        break;
                    }
                    thread::sleep(Duration::from_millis(100));
                }
                continue;
            }
            // Cross-provider writes invalidate this cheap probe immediately.
            // An unchanged empty library needs a full queue scan only every 15s.
            let version = db
                .query_row("PRAGMA data_version", [], |r| r.get::<_, i64>(0))
                .ok();
            let scan = version.is_none() || version != empty_version || Instant::now() >= next_scan;
            match if scan { next_job(&db) } else { Ok(None) } {
                Ok(Some(job)) if claim(&db, &job).is_ok() => {
                    let _ = app.emit("reference-preview-updated", ());
                    let success = enrich(
                        &mut db,
                        &job,
                        &stop,
                        &|| {
                            let _ = app.emit("reference-preview-updated", ());
                        },
                        &root,
                    );
                    if !stop.load(Ordering::Relaxed) {
                        let _ = finish(&db, &job, success);
                        let _ = app.emit("reference-preview-updated", ());
                    }
                }
                _ => {
                    if scan {
                        empty_version = version;
                        next_scan = Instant::now() + Duration::from_secs(15);
                    }
                    for _ in 0..20 {
                        if stop.load(Ordering::Relaxed) {
                            break;
                        }
                        thread::sleep(Duration::from_millis(100));
                    }
                }
            }
        }
        let _ = db.execute("DELETE FROM app_meta WHERE key IN ('web_preview_worker_until','web_preview_worker_owner') AND EXISTS (SELECT 1 FROM app_meta WHERE key='web_preview_worker_owner' AND value=?1)", [&owner]);
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn repeated_idle_lease_checks_are_read_only_even_with_a_busy_writer() {
        let root =
            std::env::temp_dir().join(format!("stashdock-idle-lease-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let db = Connection::open(root.join("test.sqlite3")).unwrap();
        db.execute_batch(
            "PRAGMA journal_mode=WAL; CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT)",
        )
        .unwrap();
        assert!(heartbeat(&db, "owner").unwrap());
        let writes = db.total_changes();
        let other = Connection::open(root.join("test.sqlite3")).unwrap();
        other.execute_batch("BEGIN IMMEDIATE").unwrap();
        for _ in 0..20 {
            assert!(heartbeat(&db, "owner").unwrap());
            assert!(!heartbeat(&db, "other").unwrap());
        }
        assert_eq!(db.total_changes(), writes);
        other.execute_batch("ROLLBACK").unwrap();
        drop(other);
        drop(db);
        std::fs::remove_dir_all(root).unwrap();
    }
    fn database() -> Connection {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("../../plugins/stashdock/server/schema.sql"))
            .unwrap();
        schema(&db).unwrap();
        db.execute("INSERT INTO stash_items(id,title,kind,source,url,excerpt,created_at,updated_at,tags_json,favorite,content,context_override,origin_json) VALUES('one','User title','web','example.org','https://example.org/','Kept', '2026-10-11','original','[\"My tag\"]',1,'Original content','My AI context','{\"platform\":\"Chrome\",\"faviconUrl\":\"https://example.org/icon.png\"}')", []).unwrap();
        db
    }
    #[test]
    fn preview_status_is_transient_and_requires_a_live_worker() {
        let db = database();
        let item: crate::library::StashItem = serde_json::from_value(json!({"id":"one","title":"User title","kind":"web","source":"example.org","url":"https://example.org/","excerpt":"Kept","tags":[],"createdAt":"2026-10-11"})).unwrap();
        let mut items = vec![item];
        annotate(&db, &mut items).unwrap();
        assert!(items[0].preview_status.is_none());
        heartbeat(&db, "test-worker").unwrap();
        annotate(&db, &mut items).unwrap();
        assert_eq!(items[0].preview_status.as_deref(), Some("queued"));
        let job = next_job(&db).unwrap().unwrap();
        claim(&db, &job).unwrap();
        annotate(&db, &mut items).unwrap();
        assert_eq!(items[0].preview_status.as_deref(), Some("working"));
        finish(&db, &job, false).unwrap();
        annotate(&db, &mut items).unwrap();
        assert_eq!(items[0].preview_status.as_deref(), Some("failed"));
        finish(&db, &job, true).unwrap();
        annotate(&db, &mut items).unwrap();
        assert_eq!(items[0].preview_status.as_deref(), Some("unavailable"));
        items[0].preview = Some("data:image/png;base64,dGVzdA==".into());
        items[0].preview_status = None;
        annotate(&db, &mut items).unwrap();
        assert!(items[0].preview_status.is_none());
        let body: String = db
            .query_row("SELECT content FROM stash_items WHERE id='one'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(body, "Original content");
    }
    #[test]
    fn completion_preserves_user_edits_and_never_resurrects_deleted_or_replaced_urls() {
        let mut db = database();
        let job = next_job(&db).unwrap().unwrap();
        claim(&db, &job).unwrap();
        assert!(merge(
            &mut db,
            &job,
            Some("data:image/jpeg;base64,dGVzdA=="),
            Some("screenshot"),
            Some("data:image/png;base64,dGVzdA==")
        )
        .unwrap());
        let fields: (String,String,String,String,i64,String) = db.query_row("SELECT title,tags_json,content,context_override,favorite,updated_at FROM stash_items", [], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?))).unwrap();
        assert_eq!(
            fields,
            (
                "User title".into(),
                "[\"My tag\"]".into(),
                "Original content".into(),
                "My AI context".into(),
                1,
                "original".into()
            )
        );
        db.execute("UPDATE stash_items SET url='https://different.org/'", [])
            .unwrap();
        assert!(!merge(&mut db, &job, Some("other"), None, None).unwrap());
        db.execute("DELETE FROM stash_items", []).unwrap();
        assert!(!merge(&mut db, &job, Some("other"), None, None).unwrap());
        assert_eq!(
            db.query_row("SELECT COUNT(*) FROM web_preview_jobs", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
    #[test]
    fn completion_does_not_replace_a_newer_extension_screenshot_or_icon() {
        let mut db = database();
        let job = next_job(&db).unwrap().unwrap();
        db.execute("UPDATE stash_items SET preview='newer preview',origin_json='{\"faviconUrl\":\"newer icon\",\"author\":\"Keep me\"}'", []).unwrap();
        assert!(!merge(
            &mut db,
            &job,
            Some("old preview"),
            Some("screenshot"),
            Some("old icon")
        )
        .unwrap());
        let (preview, origin): (String, String) = db
            .query_row("SELECT preview,origin_json FROM stash_items", [], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .unwrap();
        assert_eq!(preview, "newer preview");
        assert!(origin.contains("newer icon"));
        assert!(origin.contains("Keep me"));
    }
    #[test]
    fn queue_prioritizes_new_items_and_restarts_only_missing_work() {
        let db = database();
        let job = next_job(&db).unwrap().unwrap();
        claim(&db, &job).unwrap();
        assert!(next_job(&db).unwrap().is_none());
        finish(&db, &job, true).unwrap();
        assert!(next_job(&db).unwrap().is_none());
        db.execute("UPDATE stash_items SET url='https://changed.org/'", [])
            .unwrap();
        assert!(next_job(&db).unwrap().is_some());
    }
    #[test]
    fn persistent_pipeline_live_smoke_when_requested() {
        if std::env::var("STASHDOCK_PIPELINE_SMOKE").as_deref() != Ok("1") {
            return;
        }
        let mut db = database();
        let job = next_job(&db).unwrap().unwrap();
        claim(&db, &job).unwrap();
        assert!(enrich(
            &mut db,
            &job,
            &AtomicBool::new(false),
            &|| {},
            &std::env::temp_dir()
        ));
        finish(&db, &job, true).unwrap();
        let (preview, origin): (String, String) = db
            .query_row("SELECT preview,origin_json FROM stash_items", [], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .unwrap();
        assert!(preview.starts_with("data:image/jpeg;base64,"));
        assert!(origin.contains("screenshot"));
        assert!(next_job(&db).unwrap().is_none());
        eprintln!("Real pipeline updated an isolated in-memory library only.");
    }
}
