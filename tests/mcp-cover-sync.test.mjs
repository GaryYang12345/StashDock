import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../plugins/stashdock/server/create-server.mjs';

test('embedded App supplies the visually hidden utility used by shared form announcements', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../src/features/mcp-app/base.css', import.meta.url), 'utf8');
  assert.match(css, /\.sr-only\s*\{[^}]*position: absolute/);
  assert.match(css, /\.sr-only\s*\{[^}]*clip: rect\(0, 0, 0, 0\)/);
});

test('cover preparation is app-only, unsaved and excluded from model-facing text; imports and edits agree', async t => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-mcp-test-cover-sync-'));
  const preview = 'data:image/jpeg;base64,Y292ZXI=';
  const server = createServer({ dataDir: root, htmlUrl: new URL('../plugins/stashdock/web/shelf.html', import.meta.url), importServices: {
    prepareCover: async base64 => { if (base64 !== 'Y292ZXI=') throw Error('Unsupported image.'); return preview; },
  } });
  const client = new Client({ name: 'Cover regression fixture', version: '1' });
  const [left, right] = InMemoryTransport.createLinkedPair(); await server.connect(left); await client.connect(right);
  t.after(async () => { await client.close(); await server.close(); rmSync(root, { recursive: true, force: true }); });
  const tools = (await client.listTools()).tools;
  const tool = tools.find(tool => tool.name === 'prepare_stashdock_cover');
  assert.deepEqual(tool._meta.ui.visibility, ['app']); assert.equal(tool.annotations.readOnlyHint, true);
  const call = (name, args = {}) => client.callTool({ name, arguments: args });
  const prepared = await call('prepare_stashdock_cover', { base64: 'Y292ZXI=' });
  assert.equal(prepared._meta.preview, preview); assert.doesNotMatch(JSON.stringify(prepared.content), /data:image/);
  assert.equal((await call('list_stashdock_shelf'))._meta.items.length, 0);
  assert.equal((await call('prepare_stashdock_cover', { base64: 'aHRtbA==' })).isError, true);
  const item = { title: 'Note', kind: 'note', source: 'Notes', excerpt: 'Content', content: 'Extra content', tags: [], createdAt: '2026-10-14', preview, origin: { previewKind: 'cover', previewSource: 'custom' } };
  assert.equal((await call('import_stashdock_references', { items: [item] })).structuredContent.imported, 1);
  const [saved] = (await call('list_stashdock_shelf'))._meta.items;
  assert.equal(saved.preview, preview); assert.equal(saved.origin.previewSource, 'custom');
  const args = { id: saved.id, title: 'Edited note', tags: ['Design'] };
  assert.equal((await call('edit_stashdock_reference', { ...args, cover: { preview: 'data:image/png;base64,aHRtbA==' } })).isError, true);
  assert.equal((await call('get_stashdock_item', { id: saved.id })).structuredContent.title, 'Note');
  assert.equal((await call('edit_stashdock_reference', args)).isError, undefined);
  assert.equal((await call('list_stashdock_shelf'))._meta.items[0].preview, preview);
  assert.equal((await call('edit_stashdock_reference', { ...args, cover: { preview: null } })).isError, undefined);
  const restored = (await call('get_stashdock_item', { id: saved.id })).structuredContent;
  assert.equal(restored.content, 'Extra content'); assert.equal(restored.origin.previewSource, undefined);
  const file = { name: 'file.txt', mimeType: 'text/plain', base64: Buffer.from('Original').toString('base64'), title: 'File title', content: 'Extra file context', preview };
  assert.equal((await call('import_stashdock_files', { files: [file], tags: [] })).isError, undefined);
  const files = (await call('list_stashdock_shelf'))._meta.items.filter(item => item.kind === 'file');
  assert.equal(files[0].preview, preview); assert.equal(files[0].origin.previewSource, 'custom');
});
