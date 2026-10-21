import { createPreviewCache } from './preview-cache.mjs';
import { createContentQueue } from './content-queue.mjs';
import { createPreviewSessionPool } from './preview-session.mjs';
import { DatabaseSync } from 'node:sqlite';
import { runPreviewHelper } from './preview-helper.mjs';
export { runPreviewHelper } from './preview-helper.mjs';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCATION_KEY, resolveLibraryDirectory } from './library-location.mjs';

// Single owner across desktop and all MCP sessions. Expiry recovers a crashed owner.
export function previewQueue(dataDir, { now = () => Math.floor(Date.now()/1000), owner = `mcp:${process.pid}:${randomUUID()}`, version } = {}) {
  const db = new DatabaseSync(join(dataDir, 'stashdock.sqlite3'));
  db.exec(`PRAGMA busy_timeout=1000; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS web_preview_jobs(id TEXT PRIMARY KEY REFERENCES stash_items(id) ON DELETE CASCADE,url TEXT NOT NULL,attempts INTEGER NOT NULL,retry_at INTEGER NOT NULL,status TEXT NOT NULL);`);
  let closed = false;
  const transaction = callback => { db.exec('BEGIN IMMEDIATE'); try { const result = callback(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  const meta = key => db.prepare('SELECT value FROM app_meta WHERE key=?').get(key)?.value;
  const put = (key, value) => db.prepare('INSERT INTO app_meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
  const renew = () => {
    if (meta(LOCATION_KEY)) return false;
    const until = Number(meta('web_preview_worker_until') || 0), current = meta('web_preview_worker_owner');
    if (until > now()) {
      if (current !== owner) return false;
      if (until > now() + 60) return true;
    }
    return transaction(() => {
    if (meta(LOCATION_KEY)) return false;
    const until = Number(meta('web_preview_worker_until') || 0), current = meta('web_preview_worker_owner');
    if (until > now() && current !== owner) return false; // Also respects the older native owner without an ID.
    if (version && meta('web_preview_runtime_version') !== version) {
      db.prepare("UPDATE web_preview_jobs SET attempts=0,retry_at=0,status='failed' WHERE status IN ('failed','done') AND id IN (SELECT id FROM stash_items WHERE preview IS NULL OR preview='' OR COALESCE(json_extract(CASE WHEN json_valid(origin_json) THEN origin_json ELSE '{}' END,'$.faviconUrl'),'') NOT LIKE 'data:image/%')").run();
      put('web_preview_runtime_version', version);
    }
    put('web_preview_worker_owner', owner); put('web_preview_worker_until', now()+90); return true;
    });
  };
  let emptyVersion, emptyUntil = 0;
  const candidate = () => {
    if (db.prepare("SELECT 1 FROM web_preview_jobs WHERE status='working' AND retry_at<=? LIMIT 1").get(now())) {
      db.prepare("UPDATE web_preview_jobs SET status=CASE WHEN attempts<2 THEN 'queued' ELSE 'failed' END,retry_at=0 WHERE status='working' AND retry_at<=?").run(now());
      emptyUntil = 0;
    }
    const version = db.prepare('PRAGMA data_version').get().data_version;
    if (version === emptyVersion && now() < emptyUntil) return null;
    const row = db.prepare(`SELECT s.id,s.url,CASE WHEN s.preview IS NULL OR s.preview='' THEN 0 ELSE 1 END AS preview,s.origin_json FROM stash_items s LEFT JOIN web_preview_jobs j ON j.id=s.id AND j.url=s.url
    WHERE s.kind IN ('web','repo') AND s.url IS NOT NULL AND (s.preview IS NULL OR s.preview='' OR COALESCE(json_extract(CASE WHEN json_valid(s.origin_json) THEN s.origin_json ELSE '{}' END,'$.faviconUrl'),'') NOT LIKE 'data:image/%')
    AND (j.id IS NULL OR (j.status!='done' AND j.attempts<2 AND (j.status!='working' OR j.retry_at<=?))) ORDER BY CASE WHEN s.preview IS NULL OR s.preview='' THEN 0 ELSE 1 END,CASE WHEN j.status='queued' THEN 0 WHEN j.id IS NULL THEN 1 ELSE 2 END,s.created_at DESC,s.id LIMIT 1`).get(now());
    if (!row) { emptyVersion = version; emptyUntil = now() + 15; }
    return row;
  };
  const publish = (job, result, final) => transaction(() => {
      emptyUntil = 0;
      if (meta(LOCATION_KEY) || meta('web_preview_worker_owner') !== owner || Number(meta('web_preview_worker_until')) <= now()) return false;
      const active = db.prepare("SELECT attempts,status,retry_at FROM web_preview_jobs WHERE id=? AND url=?").get(job.id, job.url);
      if (!active || active.status !== 'working' || active.attempts !== job.attempts || active.retry_at <= now()) return false;
      const row = db.prepare('SELECT preview,origin_json FROM stash_items WHERE id=? AND url=?').get(job.id, job.url);
      if (!row) return false;
      let origin; try { origin = JSON.parse(row.origin_json || '{}'); } catch { origin = {}; }
      if (!origin || typeof origin !== 'object' || Array.isArray(origin)) origin = {};
      const safeRaster = (value, max) => typeof value === 'string' && value.length <= max && /^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value);
      const image = safeRaster(result?.preview, 750_000) && ['screenshot','cover'].includes(result.previewKind) ? result.preview : null;
      const changed = !row.preview && image;
      if (changed) origin.previewKind = result.previewKind;
      if (safeRaster(result?.faviconUrl, 32768) && (!origin.faviconUrl || origin.faviconUrl === job.faviconUrl)) origin.faviconUrl = result.faviconUrl;
      if (changed || JSON.stringify(origin) !== row.origin_json) db.prepare("UPDATE stash_items SET preview=COALESCE(NULLIF(preview,''),?),origin_json=? WHERE id=? AND url=?").run(image, JSON.stringify(origin), job.id, job.url);
      if (final) db.prepare('UPDATE web_preview_jobs SET status=?,retry_at=0 WHERE id=? AND url=?').run((row.preview || image) && safeRaster(origin.faviconUrl,32768) ? 'done' : active.attempts < 2 ? 'queued' : 'failed', job.id, job.url);
      return Boolean(changed);
  });
  return {
    owner,
    renew,
    relocated: () => Boolean(meta(LOCATION_KEY)),
    claim: () => {
      if (meta(LOCATION_KEY) || meta('web_preview_worker_owner') !== owner || Number(meta('web_preview_worker_until')) <= now()) return null;
      // Empty queues are read-only. Recheck under the write transaction before
      // claiming so competing providers cannot process the same reference.
      if (!candidate()) return null;
      return transaction(() => {
      if (meta(LOCATION_KEY) || meta('web_preview_worker_owner') !== owner || Number(meta('web_preview_worker_until')) <= now()) return null;
      const row = candidate();
      if (!row) return null;
      db.prepare(`INSERT INTO web_preview_jobs VALUES(?,?,1,?,'working') ON CONFLICT(id) DO UPDATE SET url=excluded.url,attempts=CASE WHEN web_preview_jobs.url=excluded.url THEN web_preview_jobs.attempts+1 ELSE 1 END,retry_at=excluded.retry_at,status='working'`).run(row.id, row.url, now()+60);
      let origin; try { origin = JSON.parse(row.origin_json || '{}'); } catch { origin = {}; }
      const attempts = db.prepare('SELECT attempts FROM web_preview_jobs WHERE id=?').get(row.id).attempts;
      return { id: row.id, url: row.url, attempts, faviconUrl: origin?.faviconUrl, needsPreview: !row.preview };
      });
    },
    publish: (job, result) => publish(job, result, false),
    finish: (job, result) => publish(job, result, true),
    close: () => {
      if (closed) return; closed = true;
      // Like Desktop's web_preview::release: an interrupted screenshot is handed
      // back without spending an attempt, and the lease is freed for the next owner.
      try { transaction(() => { if (meta('web_preview_worker_owner') === owner) {
        db.prepare("UPDATE web_preview_jobs SET status='queued',attempts=MAX(attempts-1,0),retry_at=0 WHERE status='working' AND retry_at>?").run(now());
        db.prepare("DELETE FROM app_meta WHERE key IN ('web_preview_worker_until','web_preview_worker_owner')").run(); } }); }
      catch { /* Another writer may be busy at shutdown; the lease will expire. */ }
      finally { db.close(); }
    },
  };
}

// Foreground link lookup uses the same packaged PDF renderer as the desktop.
export function packagedPreviewService(htmlUrl, dataDir) {
  const root = resolve(fileURLToPath(new URL('..', htmlUrl)));
  const helper = join(root, 'bin', `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'stashdock-preview.exe' : 'stashdock-preview');
  const captures = createPreviewSessionPool(helper, 2);
  // Matches IMPORT_READERS in src/lib/linkImport.ts; each reader is a short-lived text-only helper.
  const readers = createPreviewSessionPool(helper, 8);
  const cache = createPreviewCache(async (url, signal) => {
    if (!existsSync(helper)) throw Error('The document renderer is unavailable. Repair the StashDock plugin.');
    const result = await runPreviewHelper(helper, { url, lookup: true, dataDir: dataDir ? resolveLibraryDirectory(dataDir) : dataDir }, signal, { timeout: 95_000 });
    if (result.error) throw Error(result.error);
    if (typeof result.title !== 'string' || typeof result.content !== 'string') throw Error('Page details could not be read. Retry the lookup.');
    return result;
  });
  const browserImport = async job => {
    if (!existsSync(helper)) throw Error('Browser import is unavailable. Repair the StashDock plugin.');
    const result = await runPreviewHelper(helper, job, cache.signal, { maxOutput: 40_000_000 });
    if (result?.error) throw Error(result.error);
    return result;
  };
  const iconCache = createPreviewCache((key, signal) => {
    if (signal.aborted) throw Error('Icon lookup cancelled');
    return browserImport({ browserOperation: 'icons', urls: JSON.parse(key) });
  }, { maxPending: 2, maxEntries: 8 });
  return { lookup: cache.lookup, close: async () => { cache.close(); iconCache.close(); await Promise.all([captures.close(), readers.close()]); },
    content: async (url, signal) => {
      const result = await readers.run({ url, contentOnly: true }, signal, { timeout: 50_000 });
      if (result.error) throw Error(result.error);
      if (typeof result.title !== 'string' || typeof result.content !== 'string') throw Error('Page details could not be read. Retry the lookup.');
      return result;
    },
    prepareCover: async base64 => {
      if (typeof base64 !== 'string' || !base64.length || base64.length > 6_666_668) throw Error('Choose an image under 5 MB.');
      const result = await runPreviewHelper(helper, { imageOperation: 'cover', base64 }, cache.signal, { timeout: 20_000 });
      if (result.error) throw Error(result.error);
      if (typeof result.preview !== 'string' || result.preview.length > 750_000 || !result.preview.startsWith('data:image/jpeg;base64,')) throw Error('The cover could not be prepared. Choose another image.');
      return result.preview;
    },
    sources: () => browserImport({ browserOperation: 'sources' }),
    bookmarks: sourceId => browserImport({ browserOperation: 'bookmarks', sourceId }),
    icons: urls => iconCache.lookup(JSON.stringify([...new Set(urls)])),
    capture: async (job, signal, onImages) => {
    if (cache.signal.aborted || signal?.aborted) throw Error('Screenshot cancelled');
    const prior = cache.peek(job.url);
    if (prior) {
      try { const data = await prior; return { preview: data.preview, previewKind: data.previewKind, faviconUrl: data.faviconUrl }; } catch { /* Background retry is independent of a failed draft lookup. */ }
      if (cache.signal.aborted || signal?.aborted) throw Error('Screenshot cancelled');
    }
    return captures.run({ url: job.url, needPreview: job.needsPreview !== false, ...(job.faviconUrl ? { faviconUrl: job.faviconUrl } : {}) }, signal, { timeout: 55_000, onImages });
  } };
}
export function startPreviewWorker(dataDir, htmlUrl, service, { hasHelper = existsSync } = {}) {
  const root = resolve(fileURLToPath(new URL('..', htmlUrl)));
  const helper = join(root, 'bin', `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'stashdock-preview.exe' : 'stashdock-preview');
  if (!hasHelper(helper)) return undefined;
  const version = 'system-webview2:capture-v5';
  const queue = previewQueue(dataDir, { version }), controller = new AbortController();
  const contentQueue = createContentQueue(dataDir, queue.owner);
  let contentRunning = false, contentPending = Promise.resolve();
  let stopped = false, nextOwnershipCheck = 0;
  const running = [false, false], pending = [Promise.resolve(), Promise.resolve()];
  const contentTick = () => {
    if (stopped || contentRunning) return;
    contentRunning = true;
    contentPending = (async () => {
      let worked = false;
      try {
        if (!contentQueue.renew()) return;
        const job = contentQueue.claim(); if (!job) return;
        worked = true;
        let result;
        try { result = await (service?.content?.(job.url, controller.signal) ?? runPreviewHelper(helper, { url: job.url, contentOnly: true }, controller.signal, { timeout: 50_000 })); }
        catch { result = {}; }
        if (!stopped) contentQueue.finish(job, result);
      } catch (error) { console.error('StashDock content queue:', error.message); }
      finally { contentRunning = false; if (worked && !stopped) queueMicrotask(contentTick); }
    })();
  };
  const imageTick = lane => {
    if (stopped || running[lane]) return;
    running[lane] = true;
    pending[lane] = (async () => {
      let worked = false;
      try {
        if (Date.now() < nextOwnershipCheck) return;
        if (queue.relocated()) { void close(); return; }
        if (!queue.renew()) { nextOwnershipCheck = Date.now() + 15_000; return; }
        nextOwnershipCheck = 0;
        const job = queue.claim(); if (!job) return;
        worked = true;
        let result; try { result = await (service?.capture(job, controller.signal, images => { if (!stopped) queue.publish(job, images); }) ?? runPreviewHelper(helper, job, controller.signal)); } catch { result = {}; }
        if (!stopped) queue.finish(job, result);
      } catch (error) { console.error('StashDock preview queue:', error.message); }
      finally { running[lane] = false; if (worked && !stopped) queueMicrotask(() => imageTick(lane)); }
    })();
  };
  const tick = () => { imageTick(0); imageTick(1); };
  const timer = setInterval(() => { tick(); contentTick(); }, 2000); timer.unref();
  const heartbeat = setInterval(() => { if (!stopped) { try { if(running.some(Boolean))queue.renew(); if(contentRunning)contentQueue.renew(); } catch { /* A writer may briefly hold the DB. */ } } }, 15_000); heartbeat.unref();
  let closing;
  const close = () => closing ||= (async () => { stopped = true; clearInterval(timer); clearInterval(heartbeat); controller.abort(); await Promise.all([...pending, contentPending]); contentQueue.close(); queue.close(); })();
  // Acquire before first shelf read so newly imported links have truthful loading state.
  try { queue.renew(); } catch { /* Retry on the next tick. */ }
  tick(); contentTick();
  return { close };
}
