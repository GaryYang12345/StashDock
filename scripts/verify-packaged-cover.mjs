// Real packaged helper, isolated SQLite. Never changes the user's collection.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../plugins/stashdock/server/create-server.mjs';
const root = mkdtempSync(join(tmpdir(), 'stashdock-mcp-test-real-cover-'));
const server = createServer({ dataDir: root, htmlUrl: new URL('../plugins/stashdock/web/shelf.html', import.meta.url) });
const client = new Client({ name: 'Packaged cover acceptance', version: '1' });
const [left, right] = InMemoryTransport.createLinkedPair();
try {
  await server.connect(left); await client.connect(right);
  const call = (name, args) => client.callTool({ name, arguments: args });
  const bytes = readFileSync(new URL('../assets/brand/icon.png', import.meta.url));
  const started = performance.now();
  const prepared = await call('prepare_stashdock_cover', { base64: bytes.toString('base64') });
  assert.equal(prepared.isError, undefined); assert.match(prepared._meta.preview, /^data:image\/jpeg;base64,/);
  assert.doesNotMatch(JSON.stringify(prepared.content), /data:image/);
  assert.equal((await call('prepare_stashdock_cover', { base64: Buffer.from('<svg><script/></svg>').toString('base64') })).isError, true);
  const file = { name: 'original.png', mimeType: 'image/png', base64: bytes.toString('base64'), preview: prepared._meta.preview, title: 'Editable image', content: 'Extra context' };
  const imported = await call('import_stashdock_files', { files: [file], tags: ['Design'] });
  assert.equal(imported.isError, undefined);
  const [item] = (await call('list_stashdock_shelf', {}))._meta.items;
  assert.equal(item.origin.previewSource, 'custom'); assert.ok(item.preview);
  const args = { id: item.id, title: item.title, tags: ['Design'] };
  const before = await call('get_stashdock_item', { id: item.id });
  assert.deepEqual(readFileSync(before.structuredContent.assetPath), bytes);
  assert.equal((await call('edit_stashdock_reference', { ...args, cover: { preview: 'data:image/png;base64,aHRtbA==' } })).isError, true);
  assert.equal((await call('edit_stashdock_reference', { ...args, cover: { preview: null } })).isError, undefined);
  const restored = (await call('list_stashdock_shelf', {}))._meta.items[0];
  assert.match(restored.preview, /^data:image\/jpeg;base64,/); assert.equal(restored.origin.previewSource, undefined);
  const detail = (await call('get_stashdock_item', { id: item.id })).structuredContent;
  assert.equal(detail.content, 'Extra context'); assert.deepEqual(readFileSync(detail.assetPath), bytes);
  console.log(JSON.stringify({ packagedHelper: true, imageRestore: true, originalPreserved: true, elapsedMs: Math.round(performance.now() - started) }));
} finally { await client.close(); await server.close(); rmSync(root, { recursive: true, force: true }); }
