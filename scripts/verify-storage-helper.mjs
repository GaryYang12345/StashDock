// Actual packaged relocation engine, isolated from the user's library.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { runStorageHelper } from '../plugins/stashdock/server/storage-service.mjs';
import { libraryPathIdentity } from '../plugins/stashdock/server/library-location.mjs';
const root = mkdtempSync(join(tmpdir(), 'stashdock-storage-acceptance-'));
const original = join(root, 'original'), target = join(root, 'target'); mkdirSync(target);
const one = createLocalLibrary({ dataDir: original }), two = createLocalLibrary({ dataDir: original });
try {
  const bytes = Buffer.from('%PDF-1.7\nUnchanged original fixture\n');
  const file = one.importFiles([{ name: 'reference.pdf', base64: bytes.toString('base64'), title: 'Edited title', content: 'Additional AI context' }], ['Research'])[0];
  const before = (await one.read())[0];
  const result = await runStorageHelper(resolve('src-tauri/target/release/stashdock-storage.exe'), { operation: 'move', source: original, target });
  assert.equal(resolve(result.path), resolve(target));
  assert.equal(libraryPathIdentity(one.dataDir), libraryPathIdentity(target)); assert.equal(libraryPathIdentity(two.dataDir), libraryPathIdentity(target));
  const after = (await two.read())[0];
  assert.equal(after.id, file.id); assert.equal(after.title, before.title); assert.equal(after.content, before.content); assert.deepEqual(after.tags, before.tags);
  assert.deepEqual(readFileSync(after.assetPath), bytes);
  two.setFavorite(file.id, true); assert.equal((await one.read())[0].favorite, true);
  const stale = new DatabaseSync(join(original, 'stashdock.sqlite3'));
  try { assert.throws(() => stale.prepare('UPDATE stash_items SET favorite=1 WHERE id=?').run(file.id), /Library moved/); } finally { stale.close(); }
  console.log('Native storage helper: unchanged original bytes/context/tags, live clients follow one destination, stale writes rejected.');
} finally {
  one.close(); two.close();
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
  rmSync(root, { recursive: true, force: true });
}
