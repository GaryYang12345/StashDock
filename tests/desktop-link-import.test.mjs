import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/lib/linkImport.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { normalizeLink, makeLink, bookmarkCandidates, makeBrowserLinks } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const source = { id: 'chrome:Default', browser: 'Chrome', profile: 'Personal' };

test('manual links normalize tracking and reject credentials and executable schemes', () => {
  assert.equal(normalizeLink(' example.org/post/?utm_source=mail#section '), 'https://example.org/post');
  for (const url of ['javascript:alert(1)', 'file:///private', 'https://user:password@example.org', 'not a link']) assert.throws(() => normalizeLink(url));
});
test('link content is saved as the real model body, not a bookmark placeholder', () => {
  const item = makeLink({ url: 'https://github.com/org/repo', title: 'My title', content: 'Full\n\ncontext', tags: ['Research'], faviconUrl: 'https://example.org/icon.png' });
  assert.equal(item.kind, 'repo'); assert.equal(item.content, 'Full\n\ncontext'); assert.equal(item.excerpt, 'Full context'); assert.equal(item.title, 'My title'); assert.equal(item.origin.importMethod, 'manual_url');
  assert.equal(item.origin.faviconUrl, 'https://example.org/icon.png');
  const plain = makeLink({ url: 'example.org', title: '', content: '', tags: [] });
  assert.equal(plain.title, 'example.org'); assert.equal(plain.content, undefined); assert.equal(plain.excerpt, '');
});

test('PDF lookup picture is saved with the link and authoritative extracted content', () => {
  const item=makeLink({url:'https://arxiv.org/pdf/2505.22954',title:'Paper',content:'Extracted paper text',tags:['Research'],preview:'data:image/jpeg;base64,dGVzdA=='});
  assert.equal(item.url,'https://arxiv.org/pdf/2505.22954');assert.equal(item.preview,'data:image/jpeg;base64,dGVzdA==');assert.equal(item.origin.previewKind,'screenshot');assert.equal(item.content,'Extracted paper text');
});
test('automatic candidates deduplicate and identify existing URLs before selection', () => {
  const rows = bookmarkCandidates([
    { title: 'Saved', url: 'https://example.org/post/?utm_source=test', folderPath: ['Research'] },
    { title: 'Duplicate', url: 'https://example.org/post#section', folderPath: [] },
    { title: 'New', url: 'https://other.org', folderPath: [] },
    { title: 'Unsafe', url: 'javascript:alert(1)', folderPath: [] },
  ], source, [{ url: 'https://example.org/post' }]);
  assert.equal(rows.length, 2); assert.equal(rows[0].saved, true); assert.equal(rows[1].saved, false);
});
test('cached bookmark favicons feed the import rows and survive saving the new reference', () => {
  const bookmark = { title: 'Page', url: 'https://example.org', folderPath: [], faviconUrl: 'data:image/png;base64,dGVzdA==' };
  assert.equal(bookmarkCandidates([bookmark], source, [])[0].origin.faviconUrl, bookmark.faviconUrl);
  assert.equal(makeBrowserLinks([bookmark], source)[0].origin.faviconUrl, bookmark.faviconUrl);
});
test('browser imports preserve source, original date and folder provenance without invented web content', () => {
  const [item] = makeBrowserLinks([{ title: 'A', url: 'https://example.org', folderPath: ['Bookmarks bar', 'Research'], savedAt: '2026-01-01T00:00:00Z' }], source);
  assert.ok(Date.now() - Date.parse(item.createdAt) < 1000); assert.equal(item.origin.savedAt, '2026-01-01T00:00:00Z'); assert.equal(item.origin.platform, 'Chrome'); assert.equal(item.origin.importMethod, 'browser_bookmarks');
  assert.deepEqual(item.origin.folderPath, ['Bookmarks bar', 'Research']); assert.deepEqual(item.tags, []); assert.equal(item.content, undefined); assert.equal(item.excerpt, '');
});

test('desktop browser import has no search or batch tags and shares card favicons', async () => {
  const desktop = await readFile('src/components/DesktopImportDialog.tsx', 'utf8');
  assert.doesNotMatch(desktop, /Search bookmarks|batchTagsOpen|Add tags|Original files stay unchanged|source\.profile|item\.profile/);
  assert.match(desktop, /<SiteFavicon candidates=\{faviconCandidates\(item\)\}/);
  assert.match(desktop, /label: item.browser/);
  assert.match(desktop, /profiles.length \? profiles : \[next\]/);
  assert.equal((desktop.match(/className=\{styles.tabLabel\}/g) || []).length, 3);
});

test('browser discovery never swaps the import trigger label or changes its identity', async () => {
  const desktop = await readFile('src/components/DesktopImportDialog.tsx', 'utf8');
  assert.match(desktop, /DropdownMenu label=\{t\("Import from"\)\}/);
  assert.doesNotMatch(desktop, /Finding browsers|DropdownMenu label=\{sourceLoading/);
  assert.match(desktop, /aria-busy=\{sourceLoading \|\| undefined\}/);
});

test('file tags are validated and persisted in the native import transaction', async () => {
  const desktop = await readFile('src/components/DesktopImportDialog.tsx', 'utf8');
  const storage = await readFile('src/lib/storage.ts', 'utf8');
  const native = await readFile('src-tauri/src/library.rs', 'utf8');
  assert.match(desktop, /<ReferenceFileImport/);
  assert.match(await readFile('src/components/ReferenceFileImport.tsx', 'utf8'), /cleanReferenceTags/);
  assert.match(storage, /import_file_payloads/);
  assert.match(storage, /"import_files", \{ paths, tags \}/);
  assert.match(native, /let tags = clean_tags\(tags.unwrap_or_default\(\)\)\?;/);
  assert.match(native, /item.tags = tags.clone\(\);/);
  assert.ok(native.indexOf('let tags = clean_tags(tags.unwrap_or_default())?;', native.indexOf('fn prepare_file_imports')) < native.indexOf('for raw_path in paths', native.indexOf('fn prepare_file_imports')));
  assert.match(native, /if explicit_tags \{\s*item.tags = tags.clone\(\);/);
});
test('desktop and MCP share the same three-mode import without bookmark exports', async () => {
  const desktop = await readFile('src/components/DesktopImportDialog.tsx', 'utf8');
  const library = await readFile('src/features/library/LibraryView.tsx', 'utf8');
  const mcp = await readFile('src/features/mcp-app/McpShelf.tsx', 'utf8');
  assert.match(library, /components\/ReferenceImportDialog/); assert.match(mcp, /components\/ReferenceImportDialog/);
  assert.match(await readFile('src/components/ReferenceImportDialog.tsx', 'utf8'), /\.\/DesktopImportDialog/);
  assert.doesNotMatch(mcp, /components\/AddDialog/);
  assert.match(mcp, /services=\{importServices\}/); assert.match(mcp, /availableTags=\{tags.map/);
  assert.equal((desktop.match(/<TabsTrigger /g) || []).length, 3);
  assert.doesNotMatch(desktop, /Bookmarks HTML|Separate tags with commas|bookmark_html/);
  assert.match(await readFile('src/components/ReferenceTagsField.tsx', 'utf8'), /Press Enter to add a tag/); assert.match(desktop, /slice\(0, visibleCount\)/); assert.match(desktop, /edited.current.title/);
  assert.match(desktop, /onAdd\(items, persisted\);\s*onClose\(\)/);
});
test('new import surface uses Arc tokens and no competing button overrides', async () => {
  const css = await readFile('src/components/DesktopImportDialog.module.css', 'utf8');
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|(?:rgb|hsl)\(|font-weight:\s*(600|700|bold)|outline:|100vw|linear-gradient/);
  assert.doesNotMatch(css, /\.actions\s+button\s*\{|--text-sm:/);
});
