import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const compiled = await build({ entryPoints: ['src/lib/referenceCover.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { withReferenceCover, prepareReferenceCover, editReferenceCover } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));

test('custom cover overrides only thumbnail provenance and keeps all AI/reference metadata', () => {
  const item = { id: 'a', kind: 'web', title: 'Edited title', content: 'User content', tags: ['Design'], preview: 'automatic screenshot', origin: { platform: 'example.org', importMethod: 'manual_url', importedAt: '2026-10-14', previewKind: 'screenshot', faviconUrl: 'icon' } };
  assert.equal(withReferenceCover(item, null), item);
  const next = withReferenceCover(item, { name: 'cover.png', preview: 'custom image' });
  assert.deepEqual(next, { ...item, preview: 'custom image', origin: { ...item.origin, previewKind: 'cover', previewSource: 'custom' } });
  assert.equal(item.preview, 'automatic screenshot');
});

test('oversized, empty and active/nonimage cover files are rejected before native IPC', async () => {
  await assert.rejects(prepareReferenceCover({ name: 'a.png', size: 5_000_001 }), /5 MB/);
  await assert.rejects(prepareReferenceCover({ name: 'a.png', size: 0 }), /5 MB/);
  for (const name of ['script.svg', 'page.html', 'file.pdf', 'image.png.exe']) await assert.rejects(prepareReferenceCover({ name, size: 1 }), /PNG, JPG, WebP or GIF/);
});

test('cover picker is opt-in per host and never saves until explicit reference confirmation', async () => {
  const adapter = await read('src/lib/linkImport.ts');
  const mcp = await read('src/features/mcp-app/import.ts');
  const field = await read('src/components/ReferenceCoverField.tsx');
  assert.match(adapter, /prepareCover: prepareReferenceCover/);
  assert.match(mcp, /prepareCover/);
  assert.match(mcp, /prepare_stashdock_cover/);
  assert.doesNotMatch(field, /save_items|import_file|onAdd|createObjectURL/);
  assert.match(field, /alive.current/);
  assert.match(field, /event.target.value = ''/);
  assert.match(await read('src/components/ReferenceFileImport.tsx'), /draft.cover.preview/);
  assert.match(await read('src/components/DesktopImportDialog.tsx'), /withReferenceCover\(settled, covers.link/);
});

test('capture through the MCP-owned bridge preserves a local custom cover but may refresh automatic imagery', async t => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-mcp-test-custom-cover-'));
  const library = createLocalLibrary({ dataDir: root });
  t.after(() => { library.close(); rmSync(root, { recursive: true, force: true }); });
  const preview = 'data:image/jpeg;base64,Y292ZXI=';
  const raw = { kind: 'web', title: 'User title', url: 'https://example.org/custom-cover', tags: ['Design'], preview, origin: { previewKind: 'cover', previewSource: 'custom', importMethod: 'manual_url' } };
  const [item] = library.importItems([raw]).items;
  const capture = { ...raw, title: 'Captured title', preview: 'data:image/jpeg;base64,c2NyZWVuc2hvdA==', content: 'Readable body', origin: { previewKind: 'screenshot', importMethod: 'browser_extension' } };
  library.importItems([capture]);
  const saved = (await library.read()).find(row => row.id === item.id);
  assert.equal(saved.preview, preview);
  assert.equal(saved.title, 'User title');
  assert.equal(saved.content, 'Readable body');
  assert.equal(saved.origin.previewKind, 'cover');
  assert.equal(saved.origin.previewSource, 'custom');
  const [automatic] = library.importItems([{ ...raw, url: 'https://example.org/automatic', origin: { previewKind: 'cover' } }]).items;
  library.importItems([{ ...capture, url: automatic.url }]);
  assert.equal((await library.read()).find(row => row.id === automatic.id).preview, capture.preview);
});

test('editor cover has explicit unchanged, replace and default states without changing context', () => {
  const item = { id: 'a', content: 'Keep context', tags: ['Research'], preview: 'original', origin: { previewKind: 'screenshot', faviconUrl: 'icon' } };
  assert.equal(editReferenceCover(item), item);
  const replaced = editReferenceCover(item, { preview: 'replacement' });
  assert.equal(replaced.preview, 'replacement'); assert.equal(replaced.origin.previewSource, 'custom');
  const restored = editReferenceCover(replaced, { preview: null });
  assert.equal(restored.preview, undefined); assert.equal(restored.origin.previewSource, undefined);
  assert.equal(restored.origin.previewKind, undefined); assert.equal(restored.origin.faviconUrl, 'icon');
  assert.equal(restored.content, item.content); assert.equal(restored.tags, item.tags);
});

test('MCP library edits cover atomically, keeps metadata-only edits intact, and restores queue eligibility', async t => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-mcp-test-cover-edit-'));
  const library = createLocalLibrary({ dataDir: root });
  t.after(() => { library.close(); rmSync(root, { recursive: true, force: true }); });
  const preview = 'data:image/jpeg;base64,Y292ZXI=';
  const [item] = library.importItems([{ kind: 'web', title: 'Title', url: 'https://example.org/edit-cover', tags: [], preview, content: 'Full original', origin: { faviconUrl: 'icon' } }]).items;
  library.editContext(item.id, 'Extra context');
  const selected = library.editMetadata(item.id, 'New title', ['UI'], { preview });
  assert.equal(selected.preview, preview); assert.equal(selected.origin.previewSource, 'custom');
  const unchanged = library.editMetadata(item.id, 'Title only', ['UI']);
  assert.equal(unchanged.preview, preview); assert.equal(unchanged.origin.previewSource, 'custom');
  for (const invalid of ['https://example.org/image', 'data:image/svg+xml;base64,PHN2Zy8+']) {
    assert.throws(() => library.editMetadata(item.id, 'Should roll back', [], { preview: invalid }));
    assert.equal((await library.read())[0].title, 'Title only');
  }
  const restored = library.editMetadata(item.id, 'Restored', ['UI'], { preview: null });
  assert.equal(restored.preview, undefined); assert.equal(restored.origin.previewSource, undefined);
  assert.equal(restored.origin.faviconUrl, 'icon'); assert.equal(restored.content, 'Full original'); assert.equal(restored.contextOverride, 'Extra context');
});

test('MCP file covers preserve original bytes and invalid batches leave no assets', async t => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const root = mkdtempSync(join(tmpdir(), 'stashdock-mcp-test-file-cover-'));
  const library = createLocalLibrary({ dataDir: root });
  t.after(() => { library.close(); rmSync(root, { recursive: true, force: true }); });
  const file = { name: 'document.txt', base64: Buffer.from('Original bytes').toString('base64'), title: 'Edited title', content: 'Supplemental context', preview: 'data:image/jpeg;base64,Y292ZXI=' };
  assert.throws(() => library.importFiles([file, { ...file, preview: 'javascript:bad' }], []));
  assert.deepEqual(readdirSync(join(root, 'assets')), []);
  const [saved] = library.importFiles([file], ['Research']);
  assert.equal(readFileSync(saved.assetPath, 'utf8'), 'Original bytes'); assert.equal(saved.content, 'Supplemental context');
  assert.equal(saved.preview, file.preview); assert.equal(saved.origin.previewSource, 'custom');
});
