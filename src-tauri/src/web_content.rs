//! One independently leased text lane; older image-only owners cannot block it.
use rusqlite::{params, Connection, OptionalExtension};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
fn owns(db: &Connection, owner: &str) -> rusqlite::Result<bool> {
    db.query_row("SELECT COALESCE((SELECT value FROM app_meta WHERE key='web_content_worker_owner'),'')=?1
      AND COALESCE((SELECT CAST(value AS INTEGER) FROM app_meta WHERE key='web_content_worker_until'),0)>?2
      AND NOT EXISTS(SELECT 1 FROM app_meta WHERE key=?3)", params![owner,now(),crate::library_location::REDIRECT_KEY], |r| r.get(0))
}
fn renew(db: &mut Connection, owner: &str) -> rusqlite::Result<bool> {
    let check = |db: &Connection| -> rusqlite::Result<(String, i64, bool)> {
        db.query_row("SELECT COALESCE((SELECT value FROM app_meta WHERE key='web_content_worker_owner'),''),
          COALESCE((SELECT CAST(value AS INTEGER) FROM app_meta WHERE key='web_content_worker_until'),0),
          EXISTS(SELECT 1 FROM app_meta WHERE key=?1)",[crate::library_location::REDIRECT_KEY],|r| Ok((r.get(0)?,r.get(1)?,r.get(2)?)))
    };
    let (current, until, moved) = check(db)?;
    if moved || (until > now() && current != owner) {
        return Ok(false);
    }
    if until > now() + 60 && current == owner {
        return Ok(true);
    }
    let tx = db.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
    let (current, until, moved) = check(&tx)?;
    if moved || (until > now() && current != owner) {
        return Ok(false);
    }
    for (key, value) in [
        ("web_content_worker_owner", owner.to_owned()),
        ("web_content_worker_until", (now() + 90).to_string()),
    ] {
        tx.execute("INSERT INTO app_meta VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![key,value])?;
    }
    tx.commit()?;
    Ok(true)
}
fn schema(db: &Connection) -> rusqlite::Result<()> {
    db.execute_batch("PRAGMA busy_timeout=1000; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS web_content_jobs(id TEXT PRIMARY KEY REFERENCES stash_items(id) ON DELETE CASCADE,
      url TEXT NOT NULL,attempts INTEGER NOT NULL,retry_at INTEGER NOT NULL,status TEXT NOT NULL);")
}
#[derive(Debug)]
struct Job {
    id: String,
    url: String,
}
fn next(db: &Connection) -> rusqlite::Result<Option<Job>> {
    db.query_row("SELECT s.id,s.url FROM stash_items s LEFT JOIN web_content_jobs j ON j.id=s.id AND j.url=s.url
      WHERE s.kind IN ('web','repo') AND s.url IS NOT NULL AND s.context_override IS NULL
      AND COALESCE(json_extract(CASE WHEN json_valid(s.origin_json) THEN s.origin_json ELSE '{}' END,'$.contentSettled'),0)!=1
      AND ((COALESCE(trim(s.content),'')='' AND COALESCE(json_extract(CASE WHEN json_valid(s.origin_json) THEN s.origin_json ELSE '{}' END,'$.contentEdited'),0)!=1)
        OR json_extract(CASE WHEN json_valid(s.origin_json) THEN s.origin_json ELSE '{}' END,'$.pendingTitle')=s.title)
      AND json_extract(CASE WHEN json_valid(s.origin_json) THEN s.origin_json ELSE '{}' END,'$.importMethod') IN ('browser_bookmarks','manual_url')
      AND (j.id IS NULL OR (j.status!='done' AND j.attempts<3 AND j.retry_at<=?1))
      ORDER BY CASE WHEN j.id IS NULL THEN 0 ELSE 1 END,s.created_at DESC,s.id LIMIT 1", [now()], |r| Ok(Job{id:r.get(0)?,url:r.get(1)?})).optional()
}
fn claim(db: &mut Connection, owner: &str) -> rusqlite::Result<Option<Job>> {
    if !owns(db, owner)? || next(db)?.is_none() {
        return Ok(None);
    }
    let tx = db.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
    if !owns(&tx, owner)? {
        return Ok(None);
    }
    let Some(job) = next(&tx)? else {
        return Ok(None);
    };
    tx.execute("INSERT INTO web_content_jobs VALUES(?1,?2,1,?3,'working') ON CONFLICT(id) DO UPDATE SET url=excluded.url,
      attempts=CASE WHEN web_content_jobs.url=excluded.url THEN web_content_jobs.attempts+1 ELSE 1 END,retry_at=excluded.retry_at,status='working'",params![job.id,job.url,now()+60])?;
    tx.commit()?;
    Ok(Some(job))
}
fn finish(
    db: &mut Connection,
    owner: &str,
    job: &Job,
    content: Option<&str>,
    title: Option<&str>,
) -> rusqlite::Result<bool> {
    let tx = db.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
    if !owns(&tx, owner)? {
        return Ok(false);
    }
    let content = content
        .unwrap_or("")
        .trim()
        .chars()
        .take(50_000)
        .collect::<String>();
    let mut changed = false;
    let title = title
        .unwrap_or("")
        .trim()
        .chars()
        .take(500)
        .collect::<String>();
    if !content.is_empty() {
        let excerpt = content
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(180)
            .collect::<String>();
        changed=tx.execute("UPDATE stash_items SET content=?1,excerpt=CASE WHEN trim(excerpt)='' THEN ?2 ELSE excerpt END,
          updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?3 AND url=?4 AND COALESCE(trim(content),'')='' AND context_override IS NULL
          AND COALESCE(json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.contentSettled'),0)!=1
          AND COALESCE(json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.contentEdited'),0)!=1
          AND json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.importMethod') IN ('manual_url','browser_bookmarks')",params![content,excerpt,job.id,job.url])?>0;
    }
    if !title.is_empty() {
        changed=tx.execute("UPDATE stash_items SET title=?1,origin_json=json_remove(origin_json,'$.pendingTitle'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id=?2 AND url=?3 AND context_override IS NULL AND COALESCE(json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.contentSettled'),0)!=1 AND json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.pendingTitle')=title
          AND json_extract(origin_json,'$.importMethod') IN ('manual_url','browser_bookmarks')",params![title,job.id,job.url])?>0 || changed;
    }
    let remaining=tx.query_row("SELECT EXISTS(SELECT 1 FROM stash_items WHERE id=?1 AND url=?2 AND context_override IS NULL
      AND COALESCE(json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.contentSettled'),0)!=1
      AND json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.importMethod') IN ('manual_url','browser_bookmarks')
      AND ((COALESCE(trim(content),'')='' AND COALESCE(json_extract(origin_json,'$.contentEdited'),0)!=1) OR json_extract(origin_json,'$.pendingTitle')=title))",params![job.id,job.url],|r|r.get::<_,bool>(0))?;
    tx.execute(
        "UPDATE web_content_jobs SET status=?1,retry_at=?2 WHERE id=?3 AND url=?4",
        params![
            if remaining { "failed" } else { "done" },
            now() + 120,
            job.id,
            job.url
        ],
    )?;
    tx.commit()?;
    Ok(changed)
}
pub fn start(
    path: PathBuf,
    owner: String,
    stop: Arc<AtomicBool>,
    changed: impl Fn() + Send + 'static,
) {
    thread::spawn(move || {
        let Ok(mut db) = Connection::open(path) else {
            return;
        };
        if schema(&db).is_err() {
            return;
        }
        let mut empty = None;
        while !stop.load(Ordering::Relaxed) {
            if !renew(&mut db, &owner).unwrap_or(false) {
                for _ in 0..150 {
                    if stop.load(Ordering::Relaxed) {
                        break;
                    }
                    thread::sleep(Duration::from_millis(100));
                }
                continue;
            }
            let version = db
                .query_row("PRAGMA data_version", [], |r| r.get::<_, i64>(0))
                .unwrap_or(-1);
            if empty.is_some_and(|(prior, until)| prior == version && Instant::now() < until) {
                for _ in 0..20 {
                    if stop.load(Ordering::Relaxed) {
                        break;
                    }
                    thread::sleep(Duration::from_millis(100));
                }
                continue;
            }
            match claim(&mut db, &owner) {
                Ok(Some(job)) => {
                    empty = None;
                    let result = crate::link_metadata::fetch_content(&job.url);
                    if !stop.load(Ordering::Relaxed)
                        && finish(
                            &mut db,
                            &owner,
                            &job,
                            result.as_ref().ok().map(|r| r.content.as_str()),
                            result.as_ref().ok().map(|r| r.title.as_str()),
                        )
                        .unwrap_or(false)
                    {
                        changed();
                    }
                }
                _ => {
                    empty = Some((version, Instant::now() + Duration::from_secs(15)));
                    for _ in 0..20 {
                        if stop.load(Ordering::Relaxed) {
                            break;
                        }
                        thread::sleep(Duration::from_millis(100));
                    }
                }
            }
        }
        let _=db.execute("DELETE FROM app_meta WHERE key IN ('web_content_worker_owner','web_content_worker_until') AND EXISTS(SELECT 1 FROM app_meta WHERE key='web_content_worker_owner' AND value=?1)",[&owner]);
    });
}
#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> Connection {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("../../plugins/stashdock/server/schema.sql"))
            .unwrap();
        crate::library::install_search_index(&db).unwrap();
        schema(&db).unwrap();
        db.execute(
            "INSERT INTO app_meta VALUES('web_content_worker_owner','test')",
            [],
        )
        .unwrap();
        db.execute(
            "INSERT INTO app_meta VALUES('web_content_worker_until',?1)",
            [(now() + 90).to_string()],
        )
        .unwrap();
        db.execute("INSERT INTO stash_items(id,title,kind,source,url,excerpt,tags_json,created_at,origin_json,updated_at) VALUES('a','User title','web','Chrome','https://example.org','','[\"Chrome\"]','2026-10-20','{\"importMethod\":\"browser_bookmarks\"}','old')",[]).unwrap();
        db
    }
    #[test]
    fn content_publishes_with_fts_and_preserves_bookmark_metadata() {
        let mut db = fixture();
        let job = claim(&mut db, "test").unwrap().unwrap();
        assert!(finish(&mut db, "test", &job, Some("Complete article body"), None).unwrap());
        let row: (String, String, String) = db
            .query_row("SELECT title,tags_json,content FROM stash_items", [], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?))
            })
            .unwrap();
        assert_eq!(
            row,
            (
                "User title".into(),
                "[\"Chrome\"]".into(),
                "Complete article body".into()
            )
        );
        assert_eq!(
            db.query_row(
                "SELECT count(*) FROM stash_fts WHERE stash_fts MATCH 'article'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
            1
        );
    }
    #[test]
    fn late_results_cannot_replace_edits_urls_or_a_deleted_reference() {
        for edit in [
            "UPDATE stash_items SET content='Edited'",
            "UPDATE stash_items SET context_override='Custom context'",
            "UPDATE stash_items SET origin_json='{\"importMethod\":\"browser_bookmarks\",\"contentSettled\":true}'",
            "UPDATE stash_items SET url='https://other.test'",
            "DELETE FROM stash_items",
        ] {
            let mut db = fixture();
            let job = claim(&mut db, "test").unwrap().unwrap();
            db.execute_batch(edit).unwrap();
            assert!(!finish(&mut db, "test", &job, Some("Late result"), None).unwrap());
        }
    }
    #[test]
    fn settled_empty_imports_are_not_scheduled_again() {
        let mut db = fixture();
        db.execute("UPDATE stash_items SET origin_json='{\"importMethod\":\"browser_bookmarks\",\"contentSettled\":true}'", []).unwrap();
        assert!(claim(&mut db, "test").unwrap().is_none());
    }
    #[test]
    fn old_image_owner_does_not_block_text_and_provisional_titles_are_guarded() {
        let mut db = fixture();
        db.execute_batch("DELETE FROM app_meta; INSERT INTO app_meta VALUES('web_preview_worker_owner','older-image-provider'); INSERT INTO app_meta VALUES('web_preview_worker_until','9999999999');
          UPDATE stash_items SET title='example.org',origin_json='{\"importMethod\":\"manual_url\",\"pendingTitle\":\"example.org\"}';").unwrap();
        assert!(renew(&mut db, "text").unwrap());
        assert!(!renew(&mut db, "another").unwrap());
        let job = claim(&mut db, "text").unwrap().unwrap();
        assert!(finish(
            &mut db,
            "text",
            &job,
            Some("Complete body"),
            Some("Fetched title")
        )
        .unwrap());
        let title: String = db
            .query_row("SELECT title FROM stash_items", [], |r| r.get(0))
            .unwrap();
        assert_eq!(title, "Fetched title");
        assert_eq!(
            db.query_row(
                "SELECT count(*) FROM stash_fts WHERE stash_fts MATCH 'Fetched'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
            1
        );
        db.execute_batch("DELETE FROM web_content_jobs;UPDATE stash_items SET title='example.org',content=NULL,origin_json='{\"importMethod\":\"manual_url\",\"pendingTitle\":\"example.org\"}';").unwrap();
        let job = claim(&mut db, "text").unwrap().unwrap();
        db.execute("UPDATE stash_items SET origin_json=json_remove(origin_json,'$.pendingTitle') WHERE id='a'",[]).unwrap();
        finish(
            &mut db,
            "text",
            &job,
            Some("Body"),
            Some("Must not replace user title"),
        )
        .unwrap();
        assert_eq!(
            db.query_row("SELECT title FROM stash_items", [], |r| r
                .get::<_, String>(0))
                .unwrap(),
            "example.org"
        );
    }
}
