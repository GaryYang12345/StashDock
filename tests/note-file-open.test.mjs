import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { EventEmitter } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { openManagedFile } from '../plugins/stashdock/server/open-file.mjs';

test('unchanged note refresh is read-only even while another provider holds a write transaction', async t => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-note-idle-'));
  const library = createLocalLibrary({ dataDir: root });
  const note = library.saveContextReference({ title: 'Normal text file', content: 'Original' }).item;
  const writer = new DatabaseSync(join(root, 'stashdock.sqlite3'));
  try {
    writer.exec('BEGIN IMMEDIATE');
    try { assert.equal((await library.read())[0].assetPath, note.assetPath); }
    finally { writer.exec('ROLLBACK'); }
    writeFileSync(note.assetPath, 'Updated after lock release');
    assert.equal((await library.read())[0].content, 'Updated after lock release');
  } finally { writer.close(); library.close(); rmSync(root, { recursive: true, force: true }); }
});

test('Note has one real txt asset shared by providers, external edits and reopening, with context kept separate', async t => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-canonical-note-test-'));
  const first = createLocalLibrary({ dataDir: root }), second = createLocalLibrary({ dataDir: root });
  t.after(() => { first.close(); second.close(); rmSync(root, { recursive: true, force: true }); });
  const body = '完整原文\n'.repeat(6000);
  const note = first.saveContextReference({ title: 'Common rules', content: body, tags: ['Rules'] }).item;
  assert.equal(extname(note.assetPath), '.txt');
  assert.equal(readFileSync(note.assetPath, 'utf8'), note.content);
  const external = 'Edited in a normal text editor\n原文更新\n';
  writeFileSync(note.assetPath + '.editor-save', external);
  renameSync(note.assetPath + '.editor-save', note.assetPath);
  let loaded = (await second.read()).find(row => row.id === note.id);
  assert.equal(loaded.content, external); assert.equal(loaded.contextOverride, undefined);
  assert.equal(loaded.assetPath, note.assetPath);
  assert.equal(second.resolveFile(note.id).path, first.resolveFile(note.id).path);
  first.editContext(note.id, 'Updated from the card');
  assert.equal(readFileSync(note.assetPath, 'utf8'), external);
  assert.equal((await second.read()).find(row => row.id === note.id).content, external);
  assert.equal((await second.read()).find(row => row.id === note.id).contextOverride, 'Updated from the card');
  first.editMetadata(note.id, 'Renamed card', ['Rules']);
  assert.equal(first.resolveFile(note.id).path, second.resolveFile(note.id).path);
  const filesBefore = readdirSync(join(root, 'assets'));
  let launches = 0;
  const launch = (command, args, options) => {
    launches++; assert.equal(command, 'explorer.exe'); assert.equal(args[0], first.resolveFile(note.id).path);
    assert.equal(options.shell, false);
    const child = new EventEmitter(); child.unref = () => {}; queueMicrotask(() => child.emit('spawn')); return child;
  };
  await openManagedFile(note.assetPath, join(root, 'assets'), { launch, platform: 'win32' });
  await openManagedFile(note.assetPath, join(root, 'assets'), { launch, platform: 'win32' });
  assert.equal(launches, 2); assert.deepEqual(readdirSync(join(root, 'assets')), filesBefore);
  first.editContext(note.id, ''); assert.equal(readFileSync(note.assetPath, 'utf8'), external);
  rmSync(note.assetPath);
  await first.read();
  assert.throws(() => first.resolveFile(note.id), /unavailable/);
  assert.equal(readdirSync(join(root, 'assets')).length, 0, 'Missing files must not be regenerated from a stale cache');
});

test('legacy note migration preserves final text and identity and runs once, not on each open', async t => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-legacy-note-test-'));
  let library = createLocalLibrary({ dataDir: root });
  const item = library.importItems([{ title: 'Legacy note', kind: 'note', source: 'Note', content: 'Original body', tags: ['Keep'] }]).items[0];
  library.close(); rmSync(item.assetPath);
  const db = new DatabaseSync(join(root, 'stashdock.sqlite3'));
  db.prepare("UPDATE stash_items SET asset_path=NULL,context_override='Final user edit',content='Old body',favorite=1 WHERE id=?").run(item.id);
  db.close();
  library = createLocalLibrary({ dataDir: root });
  t.after(() => { library.close(); rmSync(root, { recursive: true, force: true }); });
  const [migrated] = await library.read();
  assert.equal(migrated.id, item.id); assert.equal(migrated.favorite, true); assert.deepEqual(migrated.tags, ['Keep']);
  assert.equal(readFileSync(migrated.assetPath, 'utf8'), 'Old body');
  assert.equal(migrated.contextOverride, 'Final user edit');
  const path = migrated.assetPath;
  await library.read(); await library.read();
  assert.equal(library.resolveFile(item.id).path, path);
  assert.equal(readdirSync(join(root, 'assets')).length, 1);
  const oldClient = new DatabaseSync(join(root, 'stashdock.sqlite3'));
  oldClient.prepare('UPDATE stash_items SET context_override=? WHERE id=?').run('New additional context', item.id);
  oldClient.close();
  assert.equal(readFileSync(path, 'utf8'), 'Old body');
});

test('all imported formats reopen and transfer the same latest original, with supplemental content separate', async t => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-live-original-test-'));
  const library = createLocalLibrary({ dataDir: root });
  t.after(() => { library.close(); rmSync(root, { recursive: true, force: true }); });
  for (const extension of ['txt', 'md', 'pdf', 'png', 'xlsx', 'docx']) {
    const [item] = library.importFiles([{ name: `Original.${extension}`, base64: Buffer.from('Original bytes').toString('base64'), content: 'Supplemental context' }]);
    writeFileSync(item.assetPath, 'Latest file bytes');
    const file = library.resolveFile(item.id);
    assert.equal(file.path, item.assetPath); assert.equal(readFileSync(file.path, 'utf8'), 'Latest file bytes');
    library.editContext(item.id, 'New supplemental context');
    assert.equal(readFileSync(file.path, 'utf8'), 'Latest file bytes');
  }
});
