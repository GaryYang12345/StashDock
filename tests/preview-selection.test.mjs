import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { visualSummary } from '../plugins/stashdock/server/library.mjs';
import { createServer } from '../plugins/stashdock/server/create-server.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

test('preview loading is derived from live work, not absence of an image or saved user metadata', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'stashdock-preview-state-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const library = createLocalLibrary({ dataDir: dir });
  const db = new DatabaseSync(join(dir, 'stashdock.sqlite3'));
  try {
    const item = library.importItems([{ title: 'Page', kind: 'web', source: 'example.org', url: 'https://example.org/', excerpt: '', content: 'Kept body', tags: ['Research'] }]).items[0];
    assert.equal((await library.read(true))[0].previewStatus, undefined);
    db.exec('CREATE TABLE web_preview_jobs(id TEXT PRIMARY KEY,url TEXT,status TEXT,attempts INTEGER,retry_at INTEGER)');
    db.prepare("INSERT INTO app_meta VALUES('web_preview_worker_until',?)").run(String(Date.now()/1000 + 90));
    assert.equal(visualSummary((await library.read(true))[0]).previewStatus, 'queued');
    db.prepare('INSERT INTO web_preview_jobs VALUES(?,?,?,?,?)').run(item.id, item.url, 'working', 1, Math.floor(Date.now()/1000)+60);
    assert.equal((await library.read(true))[0].previewStatus, 'working');
    db.exec("UPDATE web_preview_jobs SET retry_at=0");
    assert.equal((await library.read(true))[0].previewStatus, 'failed', 'A live provider cannot keep an expired task loading');
    db.exec("UPDATE web_preview_jobs SET status='failed',attempts=3");
    assert.equal((await library.read(true))[0].previewStatus, 'failed');
    db.exec("UPDATE web_preview_jobs SET status='done'");
    assert.equal((await library.read(true))[0].previewStatus, 'unavailable');
    db.exec("UPDATE app_meta SET value='0' WHERE key='web_preview_worker_until'");
    assert.equal((await library.read(true))[0].previewStatus, undefined);
    const row = db.prepare('SELECT content,tags_json,origin_json FROM stash_items').get();
    assert.equal(row.content, 'Kept body'); assert.equal(row.tags_json, '["Research"]');
    assert.ok(!row.origin_json.includes('previewStatus'));
  } finally { db.close(); library.close(); }
});

test('Select all includes filtered references beyond the first MCP page without fetching their bodies', async t => {
  const dataDir = mkdtempSync(join(tmpdir(), 'stashdock-selection-state-'));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const items = Array.from({ length: 65 }, (_, i) => ({ title: `Reference ${i}`, kind: 'web', source: 'Example', url: `https://example.org/${i}`, excerpt: '', tags: [i % 2 ? 'Other' : 'Research'], favorite: i % 3 === 0, content: 'Private body', createdAt: '2026-10-11' }));
  const library = createLocalLibrary({ dataDir });
  const saved = library.importItems(items).items; library.close();
  const server = createServer({ dataDir, htmlUrl: new URL('../plugins/stashdock/web/shelf.html', import.meta.url) });
  const client = new Client({ name: 'Selection regression', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(a); await client.connect(b);
    const result = await client.callTool({ name: 'select_stashdock_shelf', arguments: { tag: 'Research' } });
    assert.equal(result.isError, undefined);
    assert.equal(result._meta.ids.length, 33);
    assert.ok(result._meta.ids.every(id => Number(saved.find(item => item.id === id).title.split(' ')[1]) % 2 === 0));
    assert.ok(!JSON.stringify(result).includes('Private body'));
    const favorites = await client.callTool({ name: 'select_stashdock_shelf', arguments: { collection: 'favorites' } });
    assert.equal(favorites._meta.ids.length, 22);
  } finally { await client.close(); await server.close(); }
});

test('both surfaces share loading and Select all, and omit redundant deletion copy', () => {
  const file = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const card = file('src/components/StashCard.tsx');
  assert.match(card, /previewStatus === "queued"/); assert.match(card, /previewStatus === "working"/);
  assert.match(card, /<Skeleton.*label=\{t\("Loading preview"\)\}/);
  assert.match(card, /lines=\{5\}/);
  assert.match(card, /lines=\{3\}/);
  assert.doesNotMatch(card, /<span>Loading preview/);
  assert.match(file('src/components/ContextBar.tsx'), /SelectAllReferences/);
  for (const path of ['src/components/ContextBar.tsx', 'src/features/mcp-app/McpShelf.tsx']) assert.match(file(path), /summaryHeading/);
  assert.doesNotMatch(file('src/components/ContextBar.module.css'), /\.summary span/);
  assert.doesNotMatch(file('src-tauri/src/library/bridge.rs'), /path == "\/v1\/items"/);
  for (const path of ['src/features/library/LibraryView.tsx', 'src/features/mcp-app/McpShelf.tsx']) {
    const source = file(path);
    assert.match(source, /onSelectAll/);
    assert.doesNotMatch(source, /collectionTools/);
    assert.doesNotMatch(source, /original website|Original files, sites/);
  }
  assert.match(file('src/features/mcp-app/McpShelf.tsx'), /remaining.slice\(offset, offset \+ 30\)/);
  assert.match(file('src/features/mcp-app/McpShelf.tsx').split('<motion.footer')[1].split('</motion.footer>')[0], /SelectAllReferences/);
});
