import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { LOCATION_KEY } from './library-location.mjs';

// A lease per work lane: an older image-only provider cannot starve text work.
export function createContentQueue(dataDir, owner, { now = () => Math.floor(Date.now() / 1000) } = {}) {
  const db = new DatabaseSync(join(dataDir, 'stashdock.sqlite3'));
  db.exec(`PRAGMA busy_timeout=1000; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS web_content_jobs(id TEXT PRIMARY KEY REFERENCES stash_items(id) ON DELETE CASCADE,url TEXT NOT NULL,attempts INTEGER NOT NULL,retry_at INTEGER NOT NULL,status TEXT NOT NULL);`);
  const transaction = run => { db.exec('BEGIN IMMEDIATE'); try { const result = run(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  const owns = () => !db.prepare('SELECT 1 FROM app_meta WHERE key=?').get(LOCATION_KEY)
    && db.prepare("SELECT value FROM app_meta WHERE key='web_content_worker_owner'").get()?.value === owner
    && Number(db.prepare("SELECT value FROM app_meta WHERE key='web_content_worker_until'").get()?.value) > now();
  const renew = () => {
    if (db.prepare('SELECT 1 FROM app_meta WHERE key=?').get(LOCATION_KEY)) return false;
    const until = Number(db.prepare("SELECT value FROM app_meta WHERE key='web_content_worker_until'").get()?.value || 0);
    const current = db.prepare("SELECT value FROM app_meta WHERE key='web_content_worker_owner'").get()?.value;
    if (until > now()) { if (current !== owner) return false; if (until > now()+60) return true; }
    return transaction(() => {
      const until = Number(db.prepare("SELECT value FROM app_meta WHERE key='web_content_worker_until'").get()?.value || 0);
      const current = db.prepare("SELECT value FROM app_meta WHERE key='web_content_worker_owner'").get()?.value;
      if (db.prepare('SELECT 1 FROM app_meta WHERE key=?').get(LOCATION_KEY) || (until > now() && current !== owner)) return false;
      const put=db.prepare('INSERT INTO app_meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
      put.run('web_content_worker_owner',owner); put.run('web_content_worker_until',String(now()+90)); return true;
    });
  };
  let emptyVersion, emptyUntil = 0;
  const candidate = () => {
    const version = db.prepare('PRAGMA data_version').get().data_version;
    if (version === emptyVersion && now() < emptyUntil) return null;
    const row = db.prepare(`SELECT s.id,s.url FROM stash_items s LEFT JOIN web_content_jobs j ON j.id=s.id AND j.url=s.url
    WHERE s.kind IN ('web','repo') AND s.url IS NOT NULL AND s.context_override IS NULL
    AND COALESCE(json_extract(CASE WHEN json_valid(s.origin_json) THEN s.origin_json ELSE '{}' END,'$.contentSettled'),0)!=1
    AND ((COALESCE(trim(s.content),'')='' AND COALESCE(json_extract(CASE WHEN json_valid(s.origin_json) THEN s.origin_json ELSE '{}' END,'$.contentEdited'),0)!=1)
      OR json_extract(CASE WHEN json_valid(s.origin_json) THEN s.origin_json ELSE '{}' END,'$.pendingTitle')=s.title)
    AND json_extract(CASE WHEN json_valid(s.origin_json) THEN s.origin_json ELSE '{}' END,'$.importMethod') IN ('browser_bookmarks','manual_url')
    AND (j.id IS NULL OR (j.status!='done' AND j.attempts<3 AND j.retry_at<=?))
    ORDER BY CASE WHEN j.id IS NULL THEN 0 ELSE 1 END,s.created_at DESC,s.id LIMIT 1`).get(now());
    if (!row) { emptyVersion = version; emptyUntil = now() + 15; }
    return row;
  };
  return {
    renew,
    claim() {
      if (!owns() || !candidate()) return null;
      return transaction(() => {
        if (!owns()) return null;
        const job = candidate(); if (!job) return null;
        db.prepare(`INSERT INTO web_content_jobs VALUES(?,?,1,?,'working') ON CONFLICT(id) DO UPDATE SET url=excluded.url,
          attempts=CASE WHEN web_content_jobs.url=excluded.url THEN web_content_jobs.attempts+1 ELSE 1 END,retry_at=excluded.retry_at,status='working'`).run(job.id, job.url, now()+60);
        return job;
      });
    },
    finish(job, result) {
      emptyUntil = 0;
      return transaction(() => {
        if (!owns()) return false;
        const content = typeof result?.content === 'string' ? Array.from(result.content.trim()).slice(0, 50_000).join('') : '';
        const title = typeof result?.title === 'string' ? Array.from(result.title.trim()).slice(0,500).join('') : '';
        let changed = false;
        if (content) {
          const excerpt = Array.from(content.split(/\s+/).join(' ')).slice(0, 180).join('');
          changed = db.prepare(`UPDATE stash_items SET content=?,excerpt=CASE WHEN trim(excerpt)='' THEN ? ELSE excerpt END,
            updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND url=? AND COALESCE(trim(content),'')='' AND context_override IS NULL
            AND COALESCE(json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.contentSettled'),0)!=1
            AND COALESCE(json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.contentEdited'),0)!=1
            AND json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.importMethod') IN ('manual_url','browser_bookmarks')`).run(content, excerpt, job.id, job.url).changes > 0;
        }
        if (title) changed = db.prepare(`UPDATE stash_items SET title=?,origin_json=json_remove(origin_json,'$.pendingTitle'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id=? AND url=? AND context_override IS NULL AND COALESCE(json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.contentSettled'),0)!=1 AND json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.pendingTitle')=title
          AND json_extract(origin_json,'$.importMethod') IN ('manual_url','browser_bookmarks')`).run(title,job.id,job.url).changes > 0 || changed;
        const remaining=db.prepare(`SELECT 1 FROM stash_items WHERE id=? AND url=? AND context_override IS NULL
          AND COALESCE(json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.contentSettled'),0)!=1
          AND json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.importMethod') IN ('manual_url','browser_bookmarks')
          AND ((COALESCE(trim(content),'')='' AND COALESCE(json_extract(origin_json,'$.contentEdited'),0)!=1) OR json_extract(origin_json,'$.pendingTitle')=title)`).get(job.id,job.url);
        db.prepare('UPDATE web_content_jobs SET status=?,retry_at=? WHERE id=? AND url=?').run(remaining ? 'failed' : 'done', now()+120, job.id, job.url);
        return changed;
      });
    },
    close: () => {
      try { transaction(()=>{if(db.prepare("SELECT value FROM app_meta WHERE key='web_content_worker_owner'").get()?.value===owner)db.prepare("DELETE FROM app_meta WHERE key IN ('web_content_worker_owner','web_content_worker_until')").run();}); }
      catch { /* A busy writer may delay release; this owner's lease expires. */ }
      finally { db.close(); }
    },
  };
}
