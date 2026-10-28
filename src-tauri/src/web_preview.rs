//! A persistent, single-owner, two-lane enrichment queue. Network and rendering work
//! never hold a library lock, and completion only merges image fields by id + URL.
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

pub struct WebPreviewWorker {
    stop: Arc<AtomicBool>,
    database_path: PathBuf,
    owner: String,
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
/// On app exit: stop, hand unfinished screenshots back to the queue without
/// spending an attempt, and release the lease so another StashDock entry point
/// (such as the AI plugin) can continue at once instead of after it expires.
pub fn shutdown(app: &AppHandle) {
    stop(app);
    if let Some(worker) = app.try_state::<WebPreviewWorker>() {
        if let Ok(db) = Connection::open(&worker.database_path) {
            let _ = db.busy_timeout(Duration::from_millis(500));
            let _ = release(&db, &worker.owner);
        }
    }
}
/// Return this owner's in-flight jobs to the queue (an interrupted attempt is
/// not a failed one) and drop its lease. Jobs whose deadline already passed
/// belong to crash recovery in `next_job`.
fn release(db: &Connection, owner: &str) -> rusqlite::Result<()> {
    let tx = rusqlite::Transaction::new_unchecked(db, rusqlite::TransactionBehavior::Immediate)?;
    let owned = tx
        .query_row(
            "SELECT 1 FROM app_meta WHERE key='web_preview_worker_owner' AND value=?1",
            [owner],
            |_| Ok(()),
        )
        .optional()?
        .is_some();
    if owned {
        tx.execute("UPDATE web_preview_jobs SET status='queued',attempts=MAX(attempts-1,0),retry_at=0 WHERE status='working' AND retry_at>?1", [timestamp()])?;
        tx.execute("DELETE FROM app_meta WHERE key IN ('web_preview_worker_until','web_preview_worker_owner')", [])?;
    }
    tx.commit()
}
/// Which references changed, so the shelf re-reads only those.
fn changed(app: &AppHandle, id: &str) {
    let _ = app.emit("reference-preview-updated", json!({ "ids": [id] }));
}
fn timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

// One passive observer on the existing native queue connection. Detect external
// provider writes without repeatedly loading reference bodies or thumbnails.
#[derive(Default)]
struct ExternalChanges {
    version: Option<i64>,
    expired: Option<i64>,
    digest: Option<String>,
}
impl ExternalChanges {
    fn changed(&mut self, db: &Connection) -> rusqlite::Result<bool> {
        let version = db.query_row("PRAGMA data_version", [], |r| r.get::<_, i64>(0))?;
        let expired = db.query_row(
            "SELECT MIN(retry_at) FROM web_preview_jobs WHERE status='working' AND retry_at<=?1",
            [timestamp()],
            |r| r.get::<_, Option<i64>>(0),
        )?;
        let mut changed = self.expired != expired;
        if self.version != Some(version) {
            // Any commit moves data_version, including another provider's
            // lease renewals (about every 30 s while idle). Only references or
            // job progress the shelf shows count as a change.
            let digest = content_digest(db)?;
            changed |= self.digest.as_ref() != Some(&digest);
            self.digest = Some(digest);
        }
        self.version = Some(version);
        self.expired = expired;
        Ok(changed)
    }
}

// Observing the shared library is independent of owning the enrichment lease.
// In particular, note/favorite edits may create no preview job to notify the UI.
fn maintain_queue(
    db: &Connection,
    owner: &str,
    observer: Option<&mut ExternalChanges>,
    notify: impl FnOnce(),
) -> rusqlite::Result<bool> {
    if let Some(observer) = observer {
        if observer.changed(db)? {
            notify();
        }
    }
    heartbeat(db, owner)
}

/// What the shelf can show: references (count, last edit) and the progress of
/// cover and text jobs (published covers finish their job).
fn content_digest(db: &Connection) -> rusqlite::Result<String> {
    let items = db.query_row(
        "SELECT count(*) || ':' || COALESCE(max(updated_at),'') FROM stash_items",
        [],
        |r| r.get::<_, String>(0),
    )?;
    let jobs = |table: &str| {
        db.query_row(
            &format!("SELECT COALESCE(group_concat(status || '=' || n, ','), '') FROM (SELECT status, count(*) AS n FROM {table} GROUP BY status ORDER BY status)"),
            [],
            |r| r.get::<_, String>(0),
        )
        .optional()
        .map(Option::unwrap_or_default)
    };
    Ok(format!(
        "{items}|{}|{}",
        jobs("web_preview_jobs")?,
        jobs("web_content_jobs").unwrap_or_default()
    ))
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
    let mut query =
        db.prepare("SELECT status,retry_at,attempts FROM web_preview_jobs WHERE id=?1 AND url=?2")?;
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
            .query_row(params![item.id, url], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, i64>(1)?,
                    r.get::<_, i64>(2)?,
                ))
            })
            .optional()?;
        item.preview_status = Some(
            preview_status(
                status
                    .as_ref()
                    .map(|(status, until, attempts)| (status.as_str(), *until, *attempts)),
                timestamp(),
            )
            .into(),
        );
    }
    Ok(())
}
/// What a card shows while it has no cover. After a failed first screenshot
/// the default cover shows at once; the one background retry (scheduled after
/// every new cover) replaces it only if it succeeds, without a loading state.
/// Mirrors `previewStatus` in plugins/stashdock/server/local-library.mjs.
fn preview_status(job: Option<(&str, i64, i64)>, now: i64) -> &'static str {
    match job {
        None | Some(("queued", _, _)) => "queued",
        Some(("working", until, attempts)) if until > now && attempts < 2 => "working",
        Some(("retry" | "working" | "failed", _, _)) => "failed",
        _ => "unavailable",
    }
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
    /// Imported without text: the render's text (or a direct read) may fill it.
    needs_text: bool,
    favicon: Option<String>,
    attempts: i64,
}
fn next_job(db: &Connection) -> rusqlite::Result<Option<Job>> {
    // Recover an expired task independently of the provider's renewable lease.
    // Read first so an idle queue never needs a writer lock.
    let expired: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM web_preview_jobs WHERE status='working' AND retry_at<=?1)",
        [timestamp()],
        |r| r.get(0),
    )?;
    if expired {
        db.execute("UPDATE web_preview_jobs SET status=CASE WHEN attempts<2 THEN 'queued' ELSE 'failed' END,retry_at=0 WHERE status='working' AND retry_at<=?1", [timestamp()])?;
    }
    db.query_row("SELECT s.id, s.url, s.preview, s.origin_json, COALESCE(j.attempts,0),
          COALESCE(s.context_override IS NULL AND COALESCE(trim(s.content),'')=''
          AND COALESCE(json_extract(CASE WHEN json_valid(s.origin_json) THEN s.origin_json ELSE '{}' END,'$.contentSettled'),0)!=1
          AND COALESCE(json_extract(CASE WHEN json_valid(s.origin_json) THEN s.origin_json ELSE '{}' END,'$.contentEdited'),0)!=1
          AND json_extract(CASE WHEN json_valid(s.origin_json) THEN s.origin_json ELSE '{}' END,'$.importMethod') IN ('manual_url','browser_bookmarks'), 0)
        FROM stash_items s
        LEFT JOIN web_preview_jobs j ON j.id=s.id AND j.url=s.url
        WHERE s.kind IN ('web','repo') AND s.url IS NOT NULL
          AND (s.preview IS NULL OR s.preview='' OR COALESCE(json_extract(CASE WHEN json_valid(s.origin_json) THEN s.origin_json ELSE '{}' END, '$.faviconUrl'),'') NOT LIKE 'data:image/%')
          AND (j.id IS NULL OR (j.status != 'done' AND j.attempts < 2 AND (j.status != 'working' OR j.retry_at <= ?1)))
        ORDER BY CASE WHEN s.preview IS NULL OR s.preview='' THEN 0 ELSE 1 END, CASE WHEN j.id IS NULL OR j.status='queued' THEN 0 ELSE 1 END, s.created_at DESC, s.rowid LIMIT 1", [timestamp()], |row| {
            let origin: Option<String> = row.get(3)?;
            let favicon = origin.and_then(|value| serde_json::from_str::<Value>(&value).ok()).and_then(|origin| origin["faviconUrl"].as_str().map(str::to_string));
            let preview: Option<String> = row.get(2)?;
            Ok(Job { id: row.get(0)?, url: row.get(1)?, needs_preview: preview.as_ref().is_none_or(|value| value.is_empty()), needs_text: row.get(5)?, favicon, attempts: row.get::<_, i64>(4)? + 1 })
        }).optional()
}
fn claim(db: &Connection, job: &Job) -> rusqlite::Result<()> {
    let changed = db.execute("INSERT INTO web_preview_jobs(id,url,attempts,retry_at,status) VALUES(?1,?2,1,?3,'working')
        ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN web_preview_jobs.url=excluded.url THEN web_preview_jobs.attempts+1 ELSE 1 END,
        url=excluded.url,retry_at=excluded.retry_at,status='working'
        WHERE web_preview_jobs.url!=excluded.url OR (web_preview_jobs.status!='done' AND web_preview_jobs.attempts=?4 AND web_preview_jobs.attempts<2 AND (web_preview_jobs.status!='working' OR web_preview_jobs.retry_at<=?5))", params![job.id, job.url, timestamp()+60, job.attempts-1, timestamp()])?;
    if changed != 1 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    Ok(())
}
// No stale full-item upsert: preserve content, context overrides, tags, stars and other metadata.
fn merge(
    db: &Connection,
    job: &Job,
    preview: Option<&str>,
    kind: Option<&str>,
    favicon: Option<&str>,
) -> rusqlite::Result<bool> {
    // Image callbacks execute serially on this worker and never nest a transaction.
    let tx = rusqlite::Transaction::new_unchecked(db, rusqlite::TransactionBehavior::Immediate)?;
    let latest = tx
        .query_row(
            "SELECT origin_json,preview FROM stash_items WHERE id=?1 AND url=?2 AND EXISTS(SELECT 1 FROM web_preview_jobs WHERE id=?1 AND url=?2 AND attempts=?3 AND status='working' AND retry_at>?4)",
            params![job.id, job.url, job.attempts, timestamp()],
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
    let icon_changed = favicon.is_some()
        && current_icon != favicon
        && (current_icon.is_none() || current_icon == job.favicon.as_deref());
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
/// Text read from the same render as the screenshot. It fills a reference
/// imported without text (or replaces a shorter direct read) and then settles
/// it; never user-edited text, edited context or a settled import. Search
/// follows through the index triggers. Mirrors `publishRenderedText` in
/// plugins/stashdock/server/preview-worker.mjs.
fn merge_text(
    db: &Connection,
    job: &Job,
    content: Option<&str>,
    title: Option<&str>,
) -> rusqlite::Result<bool> {
    let content: String = content.unwrap_or("").trim().chars().take(50_000).collect();
    if content.is_empty() {
        return Ok(false);
    }
    let excerpt: String = content
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(180)
        .collect();
    let title: String = title.unwrap_or("").trim().chars().take(500).collect();
    let tx = rusqlite::Transaction::new_unchecked(db, rusqlite::TransactionBehavior::Immediate)?;
    let changed = tx.execute(
        "UPDATE stash_items SET content=?1,
           excerpt=CASE WHEN trim(excerpt)='' OR excerpt=substr(COALESCE(content,''),1,180) THEN ?2 ELSE excerpt END,
           title=CASE WHEN ?3!='' AND json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.pendingTitle')=title THEN ?3 ELSE title END,
           origin_json=json_set(json_remove(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.pendingTitle'),'$.contentSettled',json('true')),
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id=?4 AND url=?5 AND context_override IS NULL
           AND length(COALESCE(trim(content),'')) < length(?1)
           AND COALESCE(json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.contentSettled'),0)!=1
           AND COALESCE(json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.contentEdited'),0)!=1
           AND json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.importMethod') IN ('manual_url','browser_bookmarks')
           AND EXISTS(SELECT 1 FROM web_preview_jobs WHERE id=?4 AND url=?5 AND attempts=?6 AND status='working' AND retry_at>?7)",
        params![content, excerpt, title, job.id, job.url, job.attempts, timestamp()],
    )? > 0;
    tx.commit()?;
    Ok(changed)
}
fn finish(db: &Connection, job: &Job, success: bool) -> rusqlite::Result<()> {
    db.execute(
        "UPDATE web_preview_jobs SET status=?1,retry_at=0 WHERE id=?2 AND url=?3 AND attempts=?4 AND status='working' AND retry_at>?5",
        params![
            if success { "done" } else if job.attempts < 2 { "retry" } else { "failed" },
            job.id,
            job.url
            ,job.attempts,timestamp()
        ],
    )?;
    Ok(())
}
fn enrich(db: &mut Connection, job: &Job, stop: &AtomicBool, changed: &impl Fn()) -> bool {
    let images = crate::preview_enrichment::enrich(
        &job.url,
        job.needs_preview,
        job.needs_text,
        job.favicon.as_deref(),
        stop,
        |images| {
            let pictured = merge(
                db,
                job,
                images.preview.as_deref(),
                images.preview_kind.as_deref(),
                images.favicon_url.as_deref(),
            )
            .unwrap_or(false);
            let written = merge_text(db, job, images.content.as_deref(), images.title.as_deref())
                .unwrap_or(false);
            if pictured || written {
                changed();
            }
        },
        |candidate, deadline| cached_favicon(db, candidate, deadline),
    );
    (!job.needs_preview || images.preview.is_some()) && images.favicon_url.is_some()
}
/// Shared icon cache for background enrichment and native search. No library
/// mutex or SQL transaction spans the bounded image-only network operation.
type FaviconFailures = Mutex<HashMap<String, i64>>;
static FAILED_ICONS: OnceLock<FaviconFailures> = OnceLock::new();
pub(crate) fn cached_favicon(
    db: &Connection,
    candidate: &str,
    deadline: Instant,
) -> Option<String> {
    cached_favicon_with(
        db,
        FAILED_ICONS.get_or_init(Default::default),
        candidate,
        timestamp(),
        || crate::web_images::download(candidate, true, deadline).ok(),
    )
}
fn cached_favicon_with(
    db: &Connection,
    failures: &FaviconFailures,
    candidate: &str,
    now: i64,
    download: impl FnOnce() -> Option<String>,
) -> Option<String> {
    if let Some(data) = db
        .query_row(
            "SELECT data FROM web_favicon_cache WHERE url=?1",
            [candidate],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .ok()
        .flatten()
        .filter(|data| !data.is_empty())
    {
        return Some(data);
    }
    // Failure state is ephemeral. Older Desktop/plugin versions still see only
    // valid images in the shared positive-cache table, never an empty sentinel.
    if failures
        .lock()
        .ok()
        .and_then(|cache| cache.get(candidate).copied())
        .is_some_and(|retry| retry > now)
    {
        return None;
    }
    let data = download();
    if let Ok(mut cache) = failures.lock() {
        cache.retain(|_, retry| *retry > now);
        if data.is_some() {
            cache.remove(candidate);
        } else {
            if cache.len() >= 128 {
                if let Some(oldest) = cache
                    .iter()
                    .min_by_key(|(_, retry)| *retry)
                    .map(|(key, _)| key.clone())
                {
                    cache.remove(&oldest);
                }
            }
            cache.insert(candidate.into(), now + 60);
        }
    }
    if let Some(data) = data.as_deref() {
        let _=db.execute("INSERT INTO web_favicon_cache(url,data,updated_at) VALUES(?1,?2,?3) ON CONFLICT(url) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",params![candidate,data,now]);
        let _=db.execute("DELETE FROM web_favicon_cache WHERE url IN (SELECT url FROM web_favicon_cache ORDER BY updated_at DESC LIMIT -1 OFFSET 1024)",[]);
    }
    data
}

pub fn start(app: AppHandle, database_path: PathBuf) {
    let stop = Arc::new(AtomicBool::new(false));
    let owner = format!("desktop:{}:{}", std::process::id(), uuid::Uuid::new_v4());
    app.manage(WebPreviewWorker {
        stop: stop.clone(),
        database_path: database_path.clone(),
        owner: owner.clone(),
    });
    let content_app = app.clone();
    crate::web_content::start(
        database_path.clone(),
        owner.clone(),
        stop.clone(),
        move |id: &str| changed(&content_app, id),
    );
    for lane in 0..2 {
        let database_path = database_path.clone();
        let app = app.clone();
        let stop = stop.clone();
        let owner = owner.clone();
        thread::spawn(move || {
            let Ok(mut db) = Connection::open(database_path) else {
                return;
            };
            if schema(&db).is_err() {
                return;
            }
            let mut empty_version = None;
            let mut external = ExternalChanges::default();
            let mut next_scan = Instant::now();
            while !stop.load(Ordering::Relaxed) {
                let owns_queue = maintain_queue(
                    &db,
                    &owner,
                    if lane == 0 { Some(&mut external) } else { None },
                    || {
                        let _ = app.emit("reference-preview-updated", ());
                    },
                )
                .unwrap_or(false);
                if !owns_queue {
                    // Another provider owns enrichment. Check takeover infrequently,
                    // without another idle thread or any database writes.
                    for _ in 0..20 {
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
                let scan =
                    version.is_none() || version != empty_version || Instant::now() >= next_scan;
                match if scan { next_job(&db) } else { Ok(None) } {
                    Ok(Some(job)) if claim(&db, &job).is_ok() => {
                        changed(&app, &job.id);
                        let success = enrich(&mut db, &job, &stop, &|| changed(&app, &job.id));
                        if !stop.load(Ordering::Relaxed) {
                            let _ = finish(&db, &job, success);
                            changed(&app, &job.id);
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
            let _ = release(&db, &owner);
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn local_queue_owner_still_notifies_external_edits_without_preview_jobs() {
        let root =
            std::env::temp_dir().join(format!("stashdock-owner-sync-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let db = Connection::open(root.join("test.sqlite3")).unwrap();
        db.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE web_preview_jobs(status TEXT,retry_at INTEGER); CREATE TABLE stash_items(id TEXT,updated_at TEXT); CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT)").unwrap();
        let other = Connection::open(root.join("test.sqlite3")).unwrap();
        let mut observer = ExternalChanges::default();
        let notifications = std::cell::Cell::new(0);
        let notify = || notifications.set(notifications.get() + 1);
        assert!(maintain_queue(&db, "desktop-owner", Some(&mut observer), notify).unwrap());
        let baseline = notifications.get();
        other
            .execute(
                "INSERT INTO stash_items VALUES('note','2026-10-25T01:00:00Z')",
                [],
            )
            .unwrap();
        assert!(maintain_queue(&db, "desktop-owner", Some(&mut observer), notify).unwrap());
        assert_eq!(
            notifications.get(),
            baseline + 1,
            "owning the queue must not suppress a note save"
        );
        other
            .execute(
                "UPDATE stash_items SET updated_at='2026-10-25T02:00:00Z' WHERE id='note'",
                [],
            )
            .unwrap();
        assert!(maintain_queue(&db, "desktop-owner", Some(&mut observer), notify).unwrap());
        assert_eq!(
            notifications.get(),
            baseline + 2,
            "an external edit creates no screenshot job"
        );
        assert!(maintain_queue(&db, "desktop-owner", Some(&mut observer), notify).unwrap());
        assert_eq!(
            notifications.get(),
            baseline + 2,
            "unchanged checks stay quiet"
        );
        other
            .execute(
                "UPDATE app_meta SET value='other-owner' WHERE key='web_preview_worker_owner'",
                [],
            )
            .unwrap();
        other
            .execute(
                "INSERT INTO stash_items VALUES('second','2026-10-25T03:00:00Z')",
                [],
            )
            .unwrap();
        assert!(!maintain_queue(&db, "desktop-owner", Some(&mut observer), notify).unwrap());
        assert_eq!(
            notifications.get(),
            baseline + 3,
            "another owner's lease must also preserve observation"
        );
        drop(other);
        drop(db);
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn favicon_cache_reuses_success_and_briefly_remembers_failure() {
        let db = Connection::open_in_memory().unwrap();
        let failures = FaviconFailures::default();
        db.execute_batch("CREATE TABLE web_favicon_cache(url TEXT PRIMARY KEY,data TEXT NOT NULL,updated_at INTEGER NOT NULL)").unwrap();
        assert!(cached_favicon_with(
            &db,
            &failures,
            "https://example.com/favicon.ico",
            100,
            || None
        )
        .is_none());
        assert!(cached_favicon_with(
            &db,
            &failures,
            "https://example.com/favicon.ico",
            159,
            || panic!("negative cache must avoid another fetch")
        )
        .is_none());
        assert_eq!(
            db.query_row("SELECT count(*) FROM web_favicon_cache", [], |row| row
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
        assert_eq!(
            cached_favicon_with(
                &db,
                &failures,
                "https://example.com/favicon.ico",
                160,
                || Some("cached PNG".into())
            )
            .as_deref(),
            Some("cached PNG")
        );
        assert_eq!(
            cached_favicon_with(
                &db,
                &failures,
                "https://example.com/favicon.ico",
                500,
                || panic!("positive cache must be reused")
            )
            .as_deref(),
            Some("cached PNG")
        );
    }
    #[test]
    fn favicon_download_does_not_hold_a_database_transaction() {
        let root =
            std::env::temp_dir().join(format!("stashdock-icon-cache-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let path = root.join("cache.sqlite3");
        let db = Connection::open(&path).unwrap();
        db.execute_batch("CREATE TABLE web_favicon_cache(url TEXT PRIMARY KEY,data TEXT NOT NULL,updated_at INTEGER NOT NULL)").unwrap();
        let failures = FaviconFailures::default();
        let result = cached_favicon_with(&db, &failures, "https://example.com/icon", 100, || {
            assert!(failures.try_lock().is_ok());
            let writer = Connection::open(&path).unwrap();
            writer.execute_batch("BEGIN IMMEDIATE; INSERT INTO web_favicon_cache VALUES('other','concurrent',99); COMMIT;").unwrap();
            Some("new PNG".into())
        });
        assert_eq!(result.as_deref(), Some("new PNG"));
        drop(db);
        std::fs::remove_dir_all(root).unwrap();
    }

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
    fn rendered_text_fills_a_bookmark_once_and_never_user_text() {
        let db = database();
        db.execute("DELETE FROM stash_items", []).unwrap();
        for (id, origin, content) in [
            ("blank", r#"{"importMethod":"browser_bookmarks"}"#, ""),
            ("short", r#"{"importMethod":"browser_bookmarks"}"#, "Tiny"),
            (
                "edited",
                r#"{"importMethod":"browser_bookmarks","contentEdited":true}"#,
                "",
            ),
            ("note", r#"{"importMethod":"manual_note"}"#, ""),
        ] {
            db.execute("INSERT INTO stash_items(id,title,kind,source,url,excerpt,created_at,updated_at,tags_json,content,origin_json) VALUES(?1,?1,'web','e','https://example.org/'||?1,'','2026-10-22T00:00:00Z','now','[]',?2,?3)", params![id, content, origin]).unwrap();
        }
        assert!(heartbeat(&db, "me").unwrap());
        let mut written = Vec::new();
        while let Some(job) = next_job(&db).unwrap() {
            claim(&db, &job).unwrap();
            if merge_text(
                &db,
                &job,
                Some("  Rendered article body  "),
                Some("Rendered title"),
            )
            .unwrap()
            {
                written.push(job.id.clone());
            }
            assert!(
                !merge_text(&db, &job, Some("Rendered article body"), None).unwrap(),
                "a settled reference is final"
            );
            db.execute(
                "UPDATE web_preview_jobs SET status='done' WHERE id=?1",
                [&job.id],
            )
            .unwrap();
        }
        written.sort();
        assert_eq!(written, ["blank", "short"]);
        let row = |id: &str| {
            db.query_row("SELECT content,json_extract(origin_json,'$.contentSettled') FROM stash_items WHERE id=?1", [id], |r| Ok((r.get::<_, Option<String>>(0)?, r.get::<_, Option<i64>>(1)?))).unwrap()
        };
        assert_eq!(
            row("blank"),
            (Some("Rendered article body".into()), Some(1))
        );
        assert_eq!(row("edited").0.as_deref(), Some(""));
        assert_eq!(row("note").1, None);
    }
    #[test]
    fn a_failed_cover_is_retried_once_after_every_new_cover() {
        let db = database();
        db.execute("DELETE FROM stash_items", []).unwrap();
        for (id, created) in [("older", "2026-10-21"), ("newer", "2026-10-22")] {
            db.execute("INSERT INTO stash_items(id,title,kind,source,url,excerpt,created_at,updated_at,tags_json) VALUES(?1,?1,'web','e','https://example.org/'||?1,'',?2,'now','[]')", params![id, created]).unwrap();
        }
        let first = next_job(&db).unwrap().unwrap();
        assert_eq!(first.id, "newer");
        claim(&db, &first).unwrap();
        finish(&db, &first, false).unwrap();
        assert_eq!(
            next_job(&db).unwrap().unwrap().id,
            "older",
            "new covers come before a retry"
        );
        let older = next_job(&db).unwrap().unwrap();
        claim(&db, &older).unwrap();
        finish(&db, &older, true).unwrap();
        let retry = next_job(&db).unwrap().unwrap();
        assert_eq!((retry.id.as_str(), retry.attempts), ("newer", 2));
        claim(&db, &retry).unwrap();
        finish(&db, &retry, false).unwrap();
        assert!(
            next_job(&db).unwrap().is_none(),
            "after one retry the default cover stays"
        );
    }
    #[test]
    fn a_batch_imported_together_gets_covers_in_shelf_order() {
        let db = database();
        db.execute("DELETE FROM stash_items", []).unwrap();
        // One import gives every reference the same timestamp; random IDs must not decide.
        for id in ["zz", "aa", "mm"] {
            db.execute("INSERT INTO stash_items(id,title,kind,source,url,excerpt,created_at,updated_at,tags_json) VALUES(?1,?1,'web','e','https://example.org/'||?1,'','2026-10-22T00:00:00Z','now','[]')", [id]).unwrap();
        }
        let order: Vec<String> = db
            .prepare("SELECT id FROM stash_items ORDER BY created_at DESC, rowid")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(order, ["zz", "aa", "mm"]);
        let mut claimed = Vec::new();
        while let Some(job) = next_job(&db).unwrap() {
            claim(&db, &job).unwrap();
            db.execute(
                "UPDATE web_preview_jobs SET status='done' WHERE id=?1",
                [&job.id],
            )
            .unwrap();
            claimed.push(job.id);
        }
        assert_eq!(claimed, order);
    }
    #[test]
    fn quitting_returns_unfinished_work_without_spending_an_attempt() {
        let db = database();
        assert!(heartbeat(&db, "me").unwrap());
        let job = next_job(&db).unwrap().unwrap();
        claim(&db, &job).unwrap();
        db.execute("UPDATE web_preview_jobs SET attempts=2 WHERE id='one'", [])
            .unwrap();
        // Another owner's release changes nothing.
        release(&db, "someone else").unwrap();
        assert_eq!(
            db.query_row("SELECT status FROM web_preview_jobs", [], |r| r
                .get::<_, String>(0))
                .unwrap(),
            "working"
        );
        release(&db, "me").unwrap();
        let (status, attempts): (String, i64) = db
            .query_row("SELECT status,attempts FROM web_preview_jobs", [], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .unwrap();
        assert_eq!((status.as_str(), attempts), ("queued", 1));
        assert!(
            db.query_row(
                "SELECT 1 FROM app_meta WHERE key='web_preview_worker_owner'",
                [],
                |_| Ok(())
            )
            .optional()
            .unwrap()
            .is_none(),
            "the lease is free for another entry point"
        );
        assert_eq!(
            next_job(&db).unwrap().unwrap().id,
            "one",
            "the screenshot is retried on next start"
        );
    }
    #[test]
    fn external_observer_coalesces_writes_and_detects_expiry_without_writer_locks() {
        let root = std::env::temp_dir().join(format!(
            "stashdock-external-preview-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir(&root).unwrap();
        let db = Connection::open(root.join("test.sqlite3")).unwrap();
        db.execute_batch(
            "PRAGMA journal_mode=WAL; CREATE TABLE web_preview_jobs(status TEXT,retry_at INTEGER);
             CREATE TABLE stash_items(id TEXT,updated_at TEXT); CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT)",
        )
        .unwrap();
        let other = Connection::open(root.join("test.sqlite3")).unwrap();
        let mut observer = ExternalChanges::default();
        assert!(observer.changed(&db).unwrap());
        let writes = db.total_changes();
        other.execute_batch("BEGIN IMMEDIATE").unwrap();
        assert!(!observer.changed(&db).unwrap());
        other.execute_batch("ROLLBACK").unwrap();
        other
            .execute(
                "INSERT INTO web_preview_jobs VALUES('working',?1)",
                [timestamp() + 60],
            )
            .unwrap();
        assert!(observer.changed(&db).unwrap());
        assert!(!observer.changed(&db).unwrap());
        // Another provider's lease renewal is a commit, but nothing to show.
        other
            .execute(
                "INSERT OR REPLACE INTO app_meta VALUES('web_preview_worker_until','1')",
                [],
            )
            .unwrap();
        assert!(!observer.changed(&db).unwrap());
        other
            .execute("INSERT INTO stash_items VALUES('a','2026-10-23')", [])
            .unwrap();
        assert!(observer.changed(&db).unwrap());
        other
            .execute("UPDATE web_preview_jobs SET retry_at=?1", [timestamp() - 1])
            .unwrap();
        assert!(observer.changed(&db).unwrap());
        assert!(!observer.changed(&db).unwrap());
        assert_eq!(db.total_changes(), writes);
        drop(other);
        drop(db);
        std::fs::remove_dir_all(root).unwrap();
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
        // The default cover shows at once; the background retry never shows loading.
        assert_eq!(items[0].preview_status.as_deref(), Some("failed"));
        let retry = next_job(&db).unwrap().unwrap();
        claim(&db, &retry).unwrap();
        annotate(&db, &mut items).unwrap();
        assert_eq!(items[0].preview_status.as_deref(), Some("failed"));
        assert!(claim(&db, &retry).is_err());
        finish(&db, &retry, false).unwrap();
        annotate(&db, &mut items).unwrap();
        assert_eq!(items[0].preview_status.as_deref(), Some("failed"));
        assert!(next_job(&db).unwrap().is_none());
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
    fn task_expiry_is_independent_of_a_live_provider_and_late_results_are_rejected() {
        let mut db = database();
        heartbeat(&db, "live-owner").unwrap();
        let first = next_job(&db).unwrap().unwrap();
        claim(&db, &first).unwrap();
        assert!(claim(&db, &first).is_err());
        db.execute("UPDATE web_preview_jobs SET retry_at=?1", [timestamp() - 1])
            .unwrap();
        let retry = next_job(&db).unwrap().unwrap();
        assert_eq!(retry.attempts, 2);
        claim(&db, &retry).unwrap();
        assert!(!merge(&mut db, &first, Some("old image"), Some("screenshot"), None).unwrap());
        db.execute("UPDATE web_preview_jobs SET retry_at=?1", [timestamp() - 1])
            .unwrap();
        assert!(next_job(&db).unwrap().is_none());
        let status: String = db
            .query_row("SELECT status FROM web_preview_jobs", [], |r| r.get(0))
            .unwrap();
        assert_eq!(status, "failed");
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
    fn unchanged_inline_icon_does_not_rewrite_the_record_on_partial_callbacks() {
        let db = database();
        db.execute(
            "UPDATE stash_items SET origin_json='{\"faviconUrl\":\"data:image/png;base64,YQ==\"}'",
            [],
        )
        .unwrap();
        let job = next_job(&db).unwrap().unwrap();
        let writes = db.total_changes();
        assert!(!merge(&db, &job, None, None, job.favicon.as_deref()).unwrap());
        assert_eq!(db.total_changes(), writes);
    }
    #[test]
    fn missing_screenshots_precede_newer_icon_only_jobs() {
        let db = database();
        db.execute("INSERT INTO stash_items(id,title,kind,source,url,excerpt,created_at,updated_at,tags_json,favorite,preview) VALUES('newer','Already covered','web','example.org','https://example.org/new','','2026-10-20','2026-10-20','[]',0,'existing cover')", []).unwrap();
        assert_eq!(next_job(&db).unwrap().unwrap().id, "one");
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
        assert!(enrich(&mut db, &job, &AtomicBool::new(false), &|| {},));
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
