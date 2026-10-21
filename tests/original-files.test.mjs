import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { fingerprint, synchronizeOriginal } from '../plugins/stashdock/server/original-files.mjs';

// Same scenarios as src-tauri/src/library/originals.rs.
function fixture(t, text = 'alpha', fingerprinted = true) {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-originals-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const library = createLocalLibrary({ dataDir: root });
  t.after(() => library.close());
  const assets = join(root, 'assets');
  mkdirSync(join(assets, 'item'), { recursive: true });
  const original = join(root, 'Notes.md'), managed = join(assets, 'item', 'Notes.md');
  writeFileSync(original, text); writeFileSync(managed, text);
  utimesSync(original, 1000, 1000); utimesSync(managed, 1000, 1000);
  const db = new DatabaseSync(join(root, 'stashdock.sqlite3'));
  t.after(() => db.close());
  db.prepare(`INSERT INTO stash_items(id,title,kind,source,excerpt,tags_json,created_at,asset_path,original_path,mime_type,size_bytes,content,origin_json,updated_at)
    VALUES('item','Notes.md','file','Local file','','[]','now',?,?,'text/markdown',?,?,?,'now')`)
    .run(managed, original, text.length, text, JSON.stringify(fingerprinted ? { originalFingerprint: fingerprint(original) } : {}));
  return { root, assets, db, library, original: realpathSync(original), managed: realpathSync(managed) };
}

test('an unchanged original opens itself and transfers the backup', t => {
  const f = fixture(t);
  assert.deepEqual(synchronizeOriginal(f.db, f.assets, 'item'), { current: f.managed, open: f.original });
});

test('an edited original refreshes the backup, its text and search before AI reads it', t => {
  const f = fixture(t);
  writeFileSync(f.original, 'bravo updated'); utimesSync(f.original, 2000, 2000);
  const [item] = f.library.readItems(['item']);
  assert.equal(item.content, 'bravo updated');
  assert.equal(readFileSync(f.managed, 'utf8'), 'bravo updated');
  assert.deepEqual(f.library.searchIds('updated'), ['item']);
  assert.equal(f.library.resolveFile('item').path, f.managed);
  assert.equal(f.library.resolveFile('item').sizeBytes, 13);
});

test('user-written import text is kept while the file bytes refresh', t => {
  const f = fixture(t);
  f.db.exec(`UPDATE stash_items SET content='my words', origin_json=json_set(origin_json,'$.contentEdited',json('true'))`);
  writeFileSync(f.original, 'bravo'); utimesSync(f.original, 2000, 2000);
  synchronizeOriginal(f.db, f.assets, 'item');
  assert.equal(readFileSync(f.managed, 'utf8'), 'bravo');
  assert.equal(f.db.prepare('SELECT content FROM stash_items').get().content, 'my words');
});

test('a missing original falls back to the backup; a missing backup is restored from the original', t => {
  const f = fixture(t);
  unlinkSync(f.managed);
  assert.deepEqual(synchronizeOriginal(f.db, f.assets, 'item'), { current: f.managed, open: f.original });
  assert.equal(readFileSync(f.managed, 'utf8'), 'alpha');
  unlinkSync(f.original);
  assert.deepEqual(synchronizeOriginal(f.db, f.assets, 'item'), { current: f.managed, open: f.managed });
});

test('a legacy backup edited after its original stays authoritative', t => {
  const f = fixture(t, 'alpha', false);
  writeFileSync(f.managed, 'edited backup'); utimesSync(f.managed, 3000, 3000);
  assert.deepEqual(synchronizeOriginal(f.db, f.assets, 'item'), { current: f.managed, open: f.managed });
  assert.equal(readFileSync(f.managed, 'utf8'), 'edited backup');
});

test('an original of another type is ignored and a backup outside the library is refused', t => {
  const f = fixture(t);
  const other = join(f.root, 'Notes.exe'); writeFileSync(other, 'x');
  f.db.prepare('UPDATE stash_items SET original_path=?').run(other);
  assert.equal(synchronizeOriginal(f.db, f.assets, 'item').open, f.managed);
  f.db.prepare('UPDATE stash_items SET asset_path=?').run(join(f.root, 'elsewhere.md'));
  assert.throws(() => synchronizeOriginal(f.db, f.assets, 'item'));
});
