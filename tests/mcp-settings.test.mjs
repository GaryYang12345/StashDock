import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../plugins/stashdock/server/create-server.mjs';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { CODEX_PREFERENCES_KEY, readStorageInfo } from '../plugins/stashdock/server/settings.mjs';

test('Codex preferences are durable, patch-safe across sessions and separate from desktop', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-codex-settings-'));
  const one = createLocalLibrary({ dataDir: root }), two = createLocalLibrary({ dataDir: root });
  const db = new DatabaseSync(join(root, 'stashdock.sqlite3'));
  try {
    db.prepare('INSERT INTO app_meta VALUES (?,?)').run('desktop_preferences_v1', '{"language":"en","theme":"light","shortcut":"Alt+Shift+Space"}');
    assert.deepEqual(one.getCodexPreferences(), { language: 'system', theme: 'system' });
    one.saveCodexPreferences({ theme: 'dark' }); two.saveCodexPreferences({ language: 'zh' });
    assert.deepEqual(one.getCodexPreferences(), { language: 'zh', theme: 'dark' });
    assert.equal(JSON.parse(db.prepare('SELECT value FROM app_meta WHERE key=?').get('desktop_preferences_v1').value).theme, 'light');
    for (const patch of [{}, { theme: 'blue' }, { shortcut: 'x' }, { language: 'zh', path: 'C:/' }]) assert.throws(() => one.saveCodexPreferences(patch));
    assert.deepEqual(two.getCodexPreferences(), { language: 'zh', theme: 'dark' });
    db.prepare('UPDATE app_meta SET value=? WHERE key=?').run('broken JSON', CODEX_PREFERENCES_KEY);
    assert.deepEqual(one.getCodexPreferences(), { language: 'system', theme: 'system' });
    assert.equal(db.prepare('SELECT value FROM app_meta WHERE key=?').get(CODEX_PREFERENCES_KEY).value, 'broken JSON');
  } finally { one.close(); two.close(); db.close(); rmSync(root, { recursive: true, force: true }); }
});
test('MCP settings tools are app-only, bounded and do not expose paths in model content', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-codex-tool-'));
  const server = createServer({ dataDir: root, htmlUrl: new URL('../plugins/stashdock/web/shelf.html', import.meta.url) });
  const client = new Client({ name: 'settings fixture', version: '1' });
  const [left, right] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(left); await client.connect(right);
    const { tools } = await client.listTools();
    for (const name of ['get_stashdock_settings', 'save_stashdock_preferences', 'get_stashdock_storage_info']) {
      const tool = tools.find(tool => tool.name === name);
      assert.deepEqual(tool._meta.ui.visibility, ['app']);
      assert.equal(tool._meta.ui.resourceUri, undefined);
      assert.equal(tool.annotations.readOnlyHint, name !== 'save_stashdock_preferences');
    }
    const saved = await client.callTool({ name: 'save_stashdock_preferences', arguments: { preferences: { language: 'zh' } } });
    assert.equal(saved._meta.preferences.language, 'zh');
    const info = await client.callTool({ name: 'get_stashdock_settings', arguments: {} });
    assert.equal(info._meta.settings.githubUrl, 'https://github.com/GaryYang12345/StashDock');
    assert.equal(info._meta.settings.preferences.language, 'zh');
    const storage = await client.callTool({ name: 'get_stashdock_storage_info', arguments: {} });
    assert.equal(storage._meta.storage.path, root);
    assert.ok(storage._meta.storage.bytes > 0);
    assert.equal(storage._meta.storage.references, 0);
    assert.ok(!JSON.stringify(storage.content).includes(root));
    const bad = await client.callTool({ name: 'save_stashdock_preferences', arguments: { preferences: { shortcut: 'x' } } });
    assert.equal(bad.isError, true);
  } finally { await client.close(); await server.close(); rmSync(root, { recursive: true, force: true }); }
});
test('storage counts originals without reading their content or following external links', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-codex-space-'));
  const library = createLocalLibrary({ dataDir: root });
  try {
    library.importItems([{ title: 'Untranslated title', kind: 'note', source: 'Personal note', tags: [], content: 'Keep me', createdAt: '2026-10-15' }]);
    const before = await readStorageInfo(library);
    writeFileSync(join(root, 'assets', 'original.pdf'), Buffer.alloc(1234));
    writeFileSync(join(root, 'unrelated.bin'), Buffer.alloc(10000));
    try { symlinkSync(join(root, 'unrelated.bin'), join(root, 'assets', 'external.pdf')); } catch { /* Windows may not permit symlink creation. */ }
    const after = await readStorageInfo(library);
    assert.equal(after.bytes - before.bytes, 1234); assert.equal(after.references, 1);
  } finally { library.close(); rmSync(root, { recursive: true, force: true }); }
});

test('storage actions are App-only, picker paths stay in metadata and move accepts only a picker token', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-storage-tools-'));
  const calls = [];
  const server = createServer({ dataDir: root, htmlUrl: new URL('../plugins/stashdock/web/shelf.html', import.meta.url), storageServices: {
    choose: async () => ({ path: 'D:/Private fixture/New location', token: 'picker-token' }),
    open: async () => { calls.push('open'); },
    move: async token => { calls.push(token); return { path: 'D:/Private fixture/New location' }; },
  } });
  const client = new Client({ name: 'storage fixture', version: '1' });
  const [left, right] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(left); await client.connect(right);
    const { tools } = await client.listTools();
    for (const name of ['open_stashdock_storage_folder', 'choose_stashdock_storage_location', 'move_stashdock_storage']) {
      const tool = tools.find(tool => tool.name === name);
      assert.deepEqual(tool._meta.ui.visibility, ['app']); assert.equal(tool.annotations.readOnlyHint, false);
    }
    const selected = await client.callTool({ name: 'choose_stashdock_storage_location', arguments: {} });
    assert.equal(selected._meta.destination.token, 'picker-token');
    assert.ok(!JSON.stringify(selected.content).includes('Private fixture'));
    const moved = await client.callTool({ name: 'move_stashdock_storage', arguments: { token: selected._meta.destination.token } });
    assert.equal(moved.isError, undefined); assert.deepEqual(calls, ['picker-token']);
    assert.ok(!JSON.stringify(moved.content).includes('Private fixture'));
  } finally { await client.close(); await server.close(); rmSync(root, { recursive: true, force: true }); }
});
