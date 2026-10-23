import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../plugins/stashdock/server/create-server.mjs';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-mcp-test-import-'));
  t.after(() => { assert.ok(root.startsWith(join(tmpdir(), 'stashdock-mcp-test-import-'))); rmSync(root, { recursive: true, force: true }); });
  return root;
}
test('both shells use one import and view toggle, with the same metadata limits and tags', () => {
  const desktop = readFileSync('src/features/library/LibraryView.tsx', 'utf8'), mcp = readFileSync('src/features/mcp-app/McpShelf.tsx', 'utf8'), toolbar = readFileSync('src/components/Toolbar.tsx', 'utf8');
  for (const code of [desktop, mcp]) assert.match(code, /components\/ReferenceImportDialog/);
  assert.doesNotMatch(desktop, /lazy\(loadImportDialog\)|prepareImportDialog|onPrepareAdd/);
  for (const code of [desktop, mcp]) { assert.match(code, /availableTags=\{tags.map/); assert.match(code, /<ReferenceEditor/); assert.match(code, /<ContentEditor/); assert.match(code, /<TagEditor/); }
  for (const code of [mcp, toolbar]) assert.match(code, /<ReferenceViewToggle/);
  assert.doesNotMatch(mcp, /components\/AddDialog|Manage tags|Browse all tags|onPinTag/);
  assert.match(mcp, /import_stashdock_files', \{ files, tags \}/);
});
test('file tags are explicitly saved atomically, including empty tags, without per-kind replacement', t => {
  const library = createLocalLibrary({ dataDir: fixture(t) });
  try {
    const file = { name: 'context.txt', mimeType: 'text/plain', base64: Buffer.from('Final AI content').toString('base64') };
    const [row] = library.importFiles([file], ['Research', 'research']); assert.deepEqual(row.tags, ['Research']); assert.equal(row.content, 'Final AI content');
    assert.deepEqual(library.importFiles([file], [])[0].tags, []);
    assert.throws(() => library.importFiles([file], ['x'.repeat(49)]), /48 characters/);
  } finally { library.close(); }
});
test('independent App import tools are read-only/app-only and check duplicates beyond the visible page', async t => {
  const dataDir = fixture(t), library = createLocalLibrary({ dataDir });
  library.importItems(Array.from({ length: 40 }, (_, i) => ({ title: `Page ${i}`, kind: 'web', source: 'example.org', url: `https://example.org/${i}`, excerpt: '', tags: [] }))); library.close();
  const importServices = { sources: async () => [{ id: 'chrome:Default', browser: 'Chrome', profile: 'Default' }], bookmarks: async () => [{ title: 'Saved', url: 'https://example.org/39', folderPath: [] }], preview: async () => ({ title: 'Detected', content: 'Complete page text' }) };
  const server = createServer({ dataDir, htmlUrl: new URL('../plugins/stashdock/web/shelf.html', import.meta.url), importServices }), client = new Client({ name: 'Isolated import test', version: '1' });
  const [left, right] = InMemoryTransport.createLinkedPair(); await server.connect(left); await client.connect(right);
  try {
    const { tools } = await client.listTools();
    for (const name of ['list_stashdock_import_sources', 'read_stashdock_browser_bookmarks', 'preview_stashdock_link']) {
      const tool = tools.find(item => item.name === name); assert.deepEqual(tool._meta.ui.visibility, ['app']); assert.equal(tool.annotations.readOnlyHint, true);
    }
    const state = await client.callTool({ name: 'list_stashdock_import_sources', arguments: {} }); assert.equal(state._meta.existingUrls.length, 40); assert.ok(state._meta.existingUrls.includes('https://example.org/39')); assert.doesNotMatch(state.content[0].text, /example.org|Default/);
    const preview = await client.callTool({ name: 'preview_stashdock_link', arguments: { url: 'https://example.org' } }); assert.equal(preview._meta.preview.content, 'Complete page text');
    const file = await client.callTool({ name: 'import_stashdock_files', arguments: { tags: ['Research'], files: [{ name: 'Note.txt', mimeType: 'text/plain', base64: Buffer.from('Content').toString('base64') }] } }); assert.equal(file.isError, undefined); assert.deepEqual(file.structuredContent.items[0].tags, ['Research']);
  } finally { await client.close(); await server.close(); }
});
