// Run only against an assembled Mac package. The server gets a fresh test HOME.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw Error('Verify on Apple Silicon macOS.');
const root = resolve(import.meta.dirname, '..');
const plugin = resolve(process.argv[2] || resolve(root, 'output/plugin-build/darwin-arm64/plugins/stashdock'));
const scratch = await mkdtemp(join(tmpdir(), 'stashdock-plugin-smoke-'));
const library = join(scratch, 'library'), assets = join(library, 'assets');
await mkdir(assets, { recursive: true });
const original = Buffer.from('StashDock packaged MCP original bytes 中文\n');
const originalPath = join(assets, '原件 with spaces.txt');
await writeFile(originalPath, original);
const db = new DatabaseSync(join(library, 'stashdock.sqlite3'));
db.exec(await readFile(join(plugin, 'server/schema.sql'), 'utf8'));
db.prepare('INSERT INTO stash_items(id,title,kind,source,excerpt,tags_json,created_at,updated_at,asset_path,mime_type,size_bytes,content,origin_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('mac-runtime-file', 'Mac runtime original', 'file', 'Runtime verification', '', '["Runtime QA"]', '2026-10-20', '2026-10-20', originalPath, 'text/plain', original.length, 'Original must be read separately', JSON.stringify({ fileName: '原件 with spaces.txt' }));
// Test the normal registration contract. The override must not create another library.
const home = join(scratch, 'home');
const appData = join(home, 'Library/Application Support/app.stashdock.desktop');
await mkdir(appData, { recursive: true });
await writeFile(join(appData, 'library-root-v1.json'), JSON.stringify({ version: 1, anchor: library, initialized: true }));
// Browser fixtures live under the isolated HOME, never daily profiles.
for (const relative of ['Google/Chrome/Default', 'Microsoft Edge/Default']) {
  const profile = join(home, 'Library/Application Support', relative);
  await mkdir(profile, { recursive: true });
  await writeFile(join(profile, 'Bookmarks'), JSON.stringify({ roots: { bar: { type: 'folder', name: 'QA', children: [{ type: 'url', name: 'QA bookmark', url: 'https://example.org/runtime' }] } } }));
}
const firefoxProfile = join(home, 'Library/Application Support/Firefox/Profiles/qa.default');
await mkdir(firefoxProfile, { recursive: true });
const firefox = new DatabaseSync(join(firefoxProfile, 'places.sqlite'));
firefox.exec("CREATE TABLE moz_places(id INTEGER PRIMARY KEY,url TEXT,title TEXT); CREATE TABLE moz_bookmarks(id INTEGER PRIMARY KEY,type INTEGER,fk INTEGER,parent INTEGER,title TEXT,guid TEXT,dateAdded INTEGER); INSERT INTO moz_places VALUES(1,'https://example.org/runtime','QA'); INSERT INTO moz_bookmarks VALUES(1,1,1,0,'QA bookmark','link________',0);");
firefox.close();
const safariProfile = join(home, 'Library/Safari');
await mkdir(safariProfile, { recursive: true });
await writeFile(join(safariProfile, 'Bookmarks.plist'), '<?xml version="1.0"?><plist version="1.0"><dict><key>Children</key><array><dict><key>WebBookmarkType</key><string>WebBookmarkTypeLeaf</string><key>URLString</key><string>https://example.org/runtime</string><key>URIDictionary</key><dict><key>title</key><string>QA bookmark</string></dict></dict></array></dict></plist>');
const config = JSON.parse(await readFile(join(plugin, '.mcp.json'), 'utf8')).mcpServers.stashdock;
const portGuard = join(scratch, 'guard-browser-ports.mjs');
await writeFile(portGuard, `import net from 'node:net';
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  const port = typeof args[0] === 'object' ? args[0]?.port : args[0];
  if ([17863, 17864].includes(Number(port))) throw Error('An isolated package check must not claim a browser provider port.');
  return listen.apply(this, args);
};\n`);
const env = { STASHDOCK_NATIVE_HOST_REGISTRATION: 'off', NODE_OPTIONS: `--import=${pathToFileURL(portGuard).href}`, HOME: home, PATH: '/usr/bin:/bin', TMPDIR: tmpdir(), LANG: 'en_US.UTF-8', STASHDOCK_DATA_DIR: join(scratch, 'must-not-become-library') };
assert.equal(config.command, './bin/darwin-arm64/node', 'Use the host-supported plugin-relative executable without command placeholder expansion');
assert.equal(config.cwd, '.');
assert.deepEqual(config.args, ['./scripts/mcp-server.mjs']);
const transport = new StdioClientTransport({ command: config.command, args: config.args, cwd: plugin, env, stderr: 'pipe' });
let stderr = '';
transport.stderr?.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-16_000); });
const client = new Client({ name: 'stashdock-mac-package-verification', version: '1.0.0' });
const call = async (name, args) => {
  const result = await client.callTool({ name, arguments: args });
  assert.notEqual(result.isError, true, JSON.stringify(result));
  return result.structuredContent || JSON.parse(result.content.find(item => item.type === 'text').text);
};
const results = { plugin, scratch, developerPathRequired: false };
try {
  await client.connect(transport);
  const tools = await client.listTools();
  for (const name of ['search_stashdock', 'get_stashdock_file', 'save_stashdock_reference']) assert.ok(tools.tools.some(tool => tool.name === name), name);
  const sources = await client.callTool({ name: 'list_stashdock_import_sources', arguments: {} });
  assert.deepEqual(sources._meta.sources, [], 'Mac dialog opening must not probe browser roots');
  for (const browser of ['Chrome', 'Edge', 'Firefox', 'Safari']) {
    const result = await client.callTool({ name: 'read_stashdock_browser_import', arguments: { browser, requestAccess: false } });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    assert.equal(result._meta.state.status, 'ready');
    assert.equal(result._meta.state.bookmarks[0].title, 'QA bookmark');
  }
  results.fourBrowserNativeRead = true;
  const integrations = await client.callTool({ name: 'get_stashdock_integrations', arguments: {} });
  assert.equal(integrations.isError, undefined);
  assert.equal(integrations._meta.integrations.platform, 'macos');
  assert.equal(integrations._meta.integrations.links.codex, 'https://stashdock.app/guide#install-plugin', 'Both platforms use the current website installation guide');
  assert.ok(integrations._meta.integrations.items.some(item => item.id === 'safari'));
  assert.deepEqual(integrations.content, [{type:'text', text:'{}'}]);
  results.macIntegrationContract = true;
  const search = await call('search_stashdock', { query: 'Mac runtime' });
  assert.equal(search.items[0].id, 'mac-runtime-file');
  const file = await call('get_stashdock_file', { id: 'mac-runtime-file' });
  assert.equal(file.contentRead, false);
  assert.deepEqual(await readFile(file.path), original);
  const input = { title: 'Mac package saved result', content: 'Isolated packaged stdio verification', tags: ['Runtime QA'] };
  await call('save_stashdock_reference', input);
  await call('save_stashdock_reference', input);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM stash_items').get().n, 2, 'Save retries must not duplicate or write to a second library');
  const note = db.prepare('SELECT id FROM stash_items WHERE id <> ?').get('mac-runtime-file');
  for (const ids of [['mac-runtime-file'], ['mac-runtime-file', note.id]]) {
    const prepared = await client.callTool({ name: 'prepare_stashdock_attachment', arguments: { ids } });
    assert.notEqual(prepared.isError, true, JSON.stringify(prepared));
    assert.deepEqual(prepared._meta.attachment.ids, ids);
    const text = prepared._meta.attachment.content[0].resource.text;
    assert.match(text, /^# Original files\n/);
    assert.match(text, /get_stashdock_file/);
    assert.match(text, /原件 with spaces\.txt \(text\/plain\) · ID mac-runtime-file/);
    assert.ok(!text.includes(originalPath), 'Draft context must resolve originals by ID, not expose local directories');
  }
  assert.deepEqual(await readFile(file.path), original, 'Preparing single or mixed attachments must preserve original bytes');
  results.singleAndMixedAttachmentSnapshots = true;
  const resources = await client.listResources();
  assert.ok(resources.resources.some(resource => resource.uri.includes('stashdock')));
  const ui = await client.readResource({ uri: resources.resources[0].uri });
  assert.ok(ui.contents.some(content => typeof content.text === 'string' && content.text.includes('<html')));
  Object.assign(results, { stdioStartup: true, modelSearch: true, resolvedOriginalBytesRead: true, registeredLibraryUsed: true, saveRetryDeduplicated: true, packagedUIResource: true, tools: tools.tools.length });
} catch (error) {
  console.error(stderr); throw error;
} finally { await client.close(); db.close(); }
// Exercise the exact packaged helper/renderer paths, with no Desktop dependency.
const helper = join(plugin, 'bin/darwin-arm64/stashdock-preview');
const invokeHelper = (request, timeout = 30_000) => {
  const child = spawnSync(helper, [], { input: JSON.stringify(request), encoding: 'utf8', env, timeout, maxBuffer: 2_000_000 });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout); assert.ok(!result.error, result.error); return result;
};
const image = await readFile(resolve(root, 'assets/brand/icon.png'));
const cover = invokeHelper({ imageOperation: 'cover', base64: image.toString('base64') });
assert.ok(cover.preview.startsWith('data:image/jpeg;base64,'));
results.nativeCover = true;
const resolved = invokeHelper({ integrationOperation: 'resolve', id: 'chrome' });
assert.ok(resolved.application === null || resolved.application.endsWith('.app'));
results.nativeApplicationResolution = true;
const page = invokeHelper({ url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', needPreview: true }, 95_000);
assert.equal(page.previewKind, 'screenshot');
assert.ok(page.preview.startsWith('data:image/jpeg;base64,'));
results.packagedWebKitScreenshot = true;
console.log(JSON.stringify(results, null, 2));
