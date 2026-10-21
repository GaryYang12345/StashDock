// Full MCP background path against an isolated library, not the user's data.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { packagedPreviewService, startPreviewWorker } from '../plugins/stashdock/server/preview-worker.mjs';

const dir = await mkdtemp(join(tmpdir(), 'stashdock-bookmark-verify-'));
const library = createLocalLibrary({ dataDir: dir });
const html = new URL('../plugins/stashdock/web/shelf.html', import.meta.url);
const service = packagedPreviewService(html, dir);
const db = new DatabaseSync(join(dir, 'stashdock.sqlite3'));
const item = library.importItems([{ title: 'User bookmark title', kind: 'web', source: 'Chrome', url: 'https://www.rust-lang.org/learn', tags: ['Chrome', 'Keep tag'], favorite: true, excerpt: '', origin: { platform: 'Chrome', importMethod: 'browser_bookmarks' } }]).items[0];
const quick = library.importItems([{title:'rust-lang.org',kind:'web',source:'rust-lang.org',url:'https://www.rust-lang.org/learn?quick-save=1',tags:['Keep'],excerpt:'',origin:{platform:'rust-lang.org',importMethod:'manual_url',pendingTitle:'rust-lang.org'}}]).items[0];
db.prepare('INSERT INTO app_meta VALUES(?,?)').run('web_preview_worker_owner','old-image-only-provider');
db.prepare('INSERT INTO app_meta VALUES(?,?)').run('web_preview_worker_until',String(Math.floor(Date.now()/1000)+300));
const worker = startPreviewWorker(dir, html, service);
const start = performance.now();
try {
  assert.ok(worker);
  let saved, filledQuick;
  const deadline = Date.now() + 70_000;
  do {
    saved = db.prepare('SELECT * FROM stash_items WHERE id=?').get(item.id);
    filledQuick=db.prepare('SELECT title,content FROM stash_items WHERE id=?').get(quick.id);
    if (saved.content?.length > 100 && filledQuick.content?.length>100 && filledQuick.title!=='rust-lang.org') break;
    await new Promise(resolve => setTimeout(resolve, 200));
  } while (Date.now() < deadline);
  assert.ok(saved.content?.length > 100, 'Background bookmark extraction must publish real text');
  assert.ok(filledQuick.content?.length>100 && filledQuick.title!=='rust-lang.org','Quick save must fill title and content without the form remaining open');
  assert.equal(saved.title, item.title); assert.equal(saved.source, 'Chrome');
  assert.equal(saved.favorite, 1); assert.deepEqual(JSON.parse(saved.tags_json), ['Chrome', 'Keep tag']);
  assert.equal(db.prepare("SELECT count(*) AS n FROM stash_fts WHERE stash_fts MATCH 'Rust'").get().n, 2);
  const textMs = Math.round(performance.now() - start);
  const status = db.prepare('SELECT status FROM web_content_jobs WHERE id=?').get(item.id).status;
  assert.equal(status, 'done');
  console.log(JSON.stringify({ isolated: true, count: library.readIndex().length, textMs, chars: saved.content.length, quickSaveTitle:filledQuick.title,oldImageOwnerDidNotBlock:true,indexed: true, metadataPreserved: true }));
} finally {
  await Promise.all([worker?.close(), service.close()]);
  db.close(); library.close();
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
