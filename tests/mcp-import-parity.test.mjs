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
import { createImportServices, createLinkPreview, publicAddress, publicWebUrl, chromiumBookmarks, parsePage } from '../plugins/stashdock/server/import-services.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-mcp-test-import-'));
  t.after(() => { assert.ok(root.startsWith(join(tmpdir(), 'stashdock-mcp-test-import-'))); rmSync(root, { recursive: true, force: true }); });
  return root;
}
test('portable browser import discovers only known sources and never accepts filesystem paths', async t => {
  const root = fixture(t), profile = join(root, 'Google/Chrome/User Data/Default'); mkdirSync(profile, { recursive: true });
  const path = join(profile, 'Bookmarks');
  const body = JSON.stringify({ roots: { bookmark_bar: { type: 'folder', name: 'Research', children: [
    { type: 'url', name: 'Saved reference', url: 'https://example.org', date_added: '13300000000000000' },
    { type: 'url', name: 'Secret', url: 'file:///private' },
  ] } } }); writeFileSync(path, body);
  const services = createImportServices({ env: { LOCALAPPDATA: root }, platform: 'win32' });
  const sources = await services.sources(); assert.deepEqual(sources, [{ id: 'chrome:Default', browser: 'Chrome', profile: 'Default' }]);
  const rows = await services.bookmarks(sources[0].id); assert.equal(rows.length, 1); assert.equal(rows[0].title, 'Saved reference'); assert.deepEqual(rows[0].folderPath, ['Research']);
  assert.equal(readFileSync(path, 'utf8'), body);
  for (const source of [path, 'chrome:../Default', 'chrome:Missing']) await assert.rejects(services.bookmarks(source), /no longer available/);
  assert.deepEqual(await createImportServices({ env: {}, platform: 'win32' }).sources(), []);
});
test('Firefox snapshots return titles and folders without modifying its live database', async t => {
  const root = fixture(t), profile = join(root, 'Mozilla/Firefox/Profiles/fixture.default'); mkdirSync(profile, { recursive: true });
  const path = join(profile, 'places.sqlite'), db = new DatabaseSync(path);
  db.exec("CREATE TABLE moz_bookmarks(id INTEGER,parent INTEGER,title TEXT,guid TEXT,type INTEGER,fk INTEGER,dateAdded INTEGER); CREATE TABLE moz_places(id INTEGER,title TEXT,url TEXT); INSERT INTO moz_bookmarks VALUES(1,0,'Bookmarks','root',2,NULL,NULL),(2,1,'Research','folder',2,NULL,NULL),(3,2,'Saved',NULL,1,1,1700000000000000); INSERT INTO moz_places VALUES(1,'Page','https://example.org/page');"); db.close();
  const before = readFileSync(path), service = createImportServices({ env: { APPDATA: root }, platform: 'win32' });
  const [source] = await service.sources(); const [row] = await service.bookmarks(source.id);
  assert.equal(row.title, 'Saved'); assert.deepEqual(row.folderPath, ['Bookmarks', 'Research']); assert.deepEqual(readFileSync(path), before);
});
test('cached Chrome favicons survive a preceding bookmark without an icon', async t => {
  const root = fixture(t), profile = join(root, 'Google/Chrome/User Data/Default'); mkdirSync(profile, { recursive: true });
  writeFileSync(join(profile, 'Bookmarks'), JSON.stringify({ roots: { bar: { type: 'folder', children: [{ type: 'url', name: 'No icon', url: 'https://example.org/none' }, { type: 'url', name: 'With icon', url: 'https://example.org/icon' }] } } }));
  const db = new DatabaseSync(join(profile, 'Favicons')); db.exec('CREATE TABLE icon_mapping(page_url TEXT,icon_id INTEGER); CREATE TABLE favicon_bitmaps(icon_id INTEGER,width INTEGER,image_data BLOB);');
  db.prepare('INSERT INTO icon_mapping VALUES(?,?)').run('https://example.org/icon', 1); db.prepare('INSERT INTO favicon_bitmaps VALUES(?,?,?)').run(1, 32, Buffer.from([137,80,78,71,13,10,26,10])); db.close();
  const rows = await createImportServices({ env: { LOCALAPPDATA: root }, platform: 'win32' }).bookmarks('chrome:Default'); assert.equal(rows[0].faviconUrl, undefined); assert.match(rows[1].faviconUrl, /^data:image\/png;base64,/);
});
test('both shells use one import and view toggle, with the same metadata limits and tags', () => {
  const desktop = readFileSync('src/features/library/LibraryView.tsx', 'utf8'), mcp = readFileSync('src/features/mcp-app/McpShelf.tsx', 'utf8'), toolbar = readFileSync('src/components/Toolbar.tsx', 'utf8');
  for (const code of [desktop, mcp]) assert.match(code, /components\/ReferenceImportDialog/);
  assert.doesNotMatch(desktop, /lazy\(loadImportDialog\)|prepareImportDialog|onPrepareAdd/);
  for (const code of [desktop, mcp]) { assert.match(code, /availableTags=\{tags.map/); assert.match(code, /<ReferenceEditor/); assert.match(code, /<ContentEditor/); assert.match(code, /<TagEditor/); }
  for (const code of [mcp, toolbar]) assert.match(code, /<ReferenceViewToggle/);
  assert.doesNotMatch(mcp, /components\/AddDialog|Manage tags|Browse all tags|onPinTag/);
  assert.match(mcp, /import_stashdock_files', \{ files, tags \}/);
});
test('bookmark traversals reject excessive depth and preserve browser dates', () => {
  let node = { type: 'folder', children: [] }; for (let i = 0; i < 66; i++) node = { type: 'folder', children: [node] };
  assert.throws(() => chromiumBookmarks({ roots: { node } }), /too large/);
});
test('automatic link lookup blocks private DNS, credentials, non-public IPs and private redirects before connecting', async () => {
  for (const ip of ['127.0.0.1', '10.1.1.1', '169.254.169.254', '192.168.1.1', '100.64.1.1', '::1', 'fc00::1', '::ffff:8.8.8.8', '2001:db8::1']) assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress('8.8.8.8'), true); assert.equal(publicAddress('2606:4700:4700::1111'), true);
  for (const url of ['file:///secret', 'http://user:secret@example.org', 'http://example.org:8080', 'http://[::1]']) assert.throws(() => publicWebUrl(url));
  let calls = 0;
  const blocked = createLinkPreview({ resolve: async () => [{ address: '127.0.0.1', family: 4 }], request: async () => { calls++; } });
  await assert.rejects(blocked('https://example.org'), /public websites/); assert.equal(calls, 0);
  const mixed = createLinkPreview({ resolve: async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }], request: async () => { calls++; } });
  await assert.rejects(mixed('https://example.org'), /public websites/); assert.equal(calls, 0);
  const redirect = createLinkPreview({ resolve: async () => [{ address: '8.8.8.8', family: 4 }], request: async () => { calls++; return { location: 'http://127.0.0.1/secret' }; } });
  await assert.rejects(redirect('https://example.org'), /public websites/); assert.equal(calls, 1);
});
test('link lookup parses actual page content with no script execution or invented body', async () => {
  const body = Buffer.from('<html><head><title>Detected title</title><link rel="icon" href="/icon.png"></head><body><nav>Menu</nav><main><h1>Intro</h1><p>Actual content</p><script>secret()</script></main></body></html>');
  const preview = parsePage(body, 'https://example.org/post'); assert.equal(preview.title, 'Detected title'); assert.equal(preview.faviconUrl, 'https://example.org/icon.png'); assert.equal(preview.content, 'Intro\nActual content');
  const request = createLinkPreview({ resolve: async () => [{ address: '8.8.8.8', family: 4 }], request: async (url, address) => { assert.equal(address.address, '8.8.8.8'); return { body }; } });
  assert.deepEqual(await request('https://example.org/post'), preview);
});

test('transient lookup tries another checked address and PDF fallback never bypasses private DNS', async () => {
  const addresses=[{address:'8.8.8.8',family:4},{address:'1.1.1.1',family:4}], called=[];
  const lookup=createLinkPreview({resolve:async()=>addresses,request:async(_,address)=>{called.push(address.address);if(called.length===1) throw Error('Connection timed out');return {body:Buffer.from('<title>Reachable</title><main><p>Actual page</p></main>')};}});
  assert.equal((await lookup('https://example.org')).title,'Reachable'); assert.deepEqual(called,['8.8.8.8','1.1.1.1']);
  let fallbacks=0;
  const fallback=async()=>{fallbacks++;return {title:'PDF title',content:'PDF text',preview:'data:image/jpeg;base64,dGVzdA=='};};
  const pdf=createLinkPreview({resolve:async()=>addresses,request:async()=>{throw Error('PDF document');},fallback});
  assert.equal((await pdf('https://example.org/paper.pdf')).title,'PDF title');assert.equal(fallbacks,1);
  const blocked=createLinkPreview({resolve:async()=>[{address:'127.0.0.1',family:4}],request:async()=>{throw Error('Must not connect');},fallback});
  await assert.rejects(blocked('https://example.org'),/public websites/);assert.equal(fallbacks,1);
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
