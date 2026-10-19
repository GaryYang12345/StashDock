// Reproducible isolated comparison. No live data, accounts or network access.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';

const source = resolve(process.argv[2] || '.');
const { createLocalLibrary } = await import(pathToFileURL(join(source, 'plugins/stashdock/server/local-library.mjs')));
const { previewQueue } = await import(pathToFileURL(join(source, 'plugins/stashdock/server/preview-worker.mjs')));
const root = mkdtempSync(join(tmpdir(), 'stashdock-stage-perf-'));
let library, db, q;
try {
  library = createLocalLibrary({ dataDir: root });
  db = new DatabaseSync(join(root, 'stashdock.sqlite3'));
  mkdirSync(join(root, 'assets'), { recursive: true });
  const insert = db.prepare(`INSERT INTO stash_items(id,title,kind,source,excerpt,tags_json,created_at,updated_at,asset_path,content,mime_type,size_bytes,preview,origin_json) VALUES(?,?,'note','Note','','[]','2026-10-17','2026-10-17',?,?,'text/plain',?,?,'{}')`);
  const body = 'Context content.\n'.repeat(1024), cover = 'data:image/jpeg;base64,' + 'YQ=='.repeat(30_000);
  db.exec('BEGIN');
  for (let i = 0; i < 200; i++) {
    const file = join(root, 'assets', `note-${i}.txt`); writeFileSync(file, body);
    insert.run(String(i), `Note ${i}`, file, body, Buffer.byteLength(body), cover);
  }
  db.exec('COMMIT');
  const elapsed = [];
  for (let i = 0; i < 8; i++) { const start = performance.now(); if (library.readShelf) library.readShelf({ limit: 30 }); else { const { search } = await import(pathToFileURL(join(source, 'plugins/stashdock/server/library.mjs'))); search(await library.read(), { limit: 30 }); } elapsed.push(performance.now() - start); }
  let clock = 100;
  q = previewQueue(root, { owner: 'benchmark', now: () => clock }); q.renew(); q.claim();
  const version = () => db.prepare('PRAGMA data_version').get().data_version;
  let previous = version(), commits = 0;
  const start = performance.now();
  for (let i = 0; i < 100; i++) { clock += 2; q.renew(); q.claim(); const current = version(); if (current !== previous) commits++; previous = current; }
  elapsed.sort((a, b) => a - b);
  console.log(JSON.stringify({ source, fixtureNotes: 200, unchangedVisualReadMedianMs: Number(elapsed[4].toFixed(2)), unchangedVisualReadMaxMs: Number(elapsed[7].toFixed(2)), idle100ChecksMs: Number((performance.now()-start).toFixed(2)), idleLeaseCommits: commits, maxResidentMB: Number((process.resourceUsage().maxRSS / 1024).toFixed(1)), realLibraryWrites: 0 }));
} finally { q?.close(); db?.close(); library?.close(); rmSync(root, { recursive: true, force: true }); }
