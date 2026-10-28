// Validate the extracted artifact, not source dependencies or developer PATH.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const { version } = JSON.parse(await readFile('plugins/stashdock/.codex-plugin/plugin.json', 'utf8'));
const root = await realpath(resolve(process.argv[2] || `output/releases/stashdock-plugin-${version}-win32-x64`));
const manifest = JSON.parse(await readFile(join(root, 'RELEASE_MANIFEST.json'), 'utf8'));
for (const file of manifest.files) {
  const path = await realpath(resolve(root, file.path)), inside = relative(root, path);
  assert.ok(inside && !inside.startsWith('..') && !isAbsolute(inside), 'File escapes the extracted release');
  const bytes = await readFile(path);
  assert.equal(bytes.length, file.bytes, `Length mismatch: ${file.path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `Checksum mismatch: ${file.path}`);
}
const plugin = await realpath(resolve(process.argv[3] || join(root, 'plugins/stashdock')));
if (process.argv[3]) for (const file of manifest.files.filter(file => file.path.startsWith('plugins/stashdock/'))) {
  const bytes = await readFile(join(plugin, file.path.slice('plugins/stashdock/'.length)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `Installed file mismatch: ${file.path}`);
}
const config = JSON.parse(await readFile(join(plugin, '.mcp.json'), 'utf8')).mcpServers.stashdock;
assert.match(config.command, /^\.\/bin\/win32-x64\/node\.exe$/);
assert.equal(config.cwd, '.');
assert.deepEqual(config.args, ['scripts/mcp-server.mjs']);
const node = resolve(plugin, config.command);
for (const binary of ['node.exe', 'stashdock-preview.exe', 'stashdock-storage.exe', 'stashdock-browser.exe']) {
  const bytes = await readFile(join(plugin, 'bin/win32-x64', binary));
  assert.equal(bytes.readUInt16LE(bytes.readUInt32LE(0x3c) + 4), 0x8664, `${binary} is not x64`);
}
const lock = JSON.parse(await readFile(new URL('./node-runtime-lock.json', import.meta.url), 'utf8'));
assert.equal(createHash('sha256').update(await readFile(node)).digest('hex'), lock.sha256);
assert.equal(execFileSync(node, ['--version'], { env: { ...process.env, STASHDOCK_NATIVE_HOST_REGISTRATION: 'off', PATH: '' }, encoding: 'utf8', windowsHide: true }).trim(), `v${manifest.node}`);
const fixture = await mkdtemp(join(tmpdir(), 'stashdock-release-check-'));
const portGuard = join(fixture, 'guard-browser-ports.mjs');
await writeFile(portGuard, `import net from 'node:net';
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  const port = typeof args[0] === 'object' ? args[0]?.port : args[0];
  if ([17863, 17864].includes(Number(port))) throw Error('An isolated release check must not claim a browser provider port.');
  return listen.apply(this, args);
};\n`);
const env = { ...process.env, STASHDOCK_NATIVE_HOST_REGISTRATION: 'off', PATH: '', STASHDOCK_DATA_DIR: join(fixture, 'library'), APPDATA: join(fixture, 'profile'), LOCALAPPDATA: join(fixture, 'local'), XDG_DATA_HOME: join(fixture, 'profile') };
env.NODE_OPTIONS = `--import=${pathToFileURL(portGuard).href}`;
const client = new Client({ name: 'StashDock extracted-release verification', version: '1' });
const transport = new StdioClientTransport({ command: config.command, args: config.args, cwd: resolve(plugin, config.cwd), env, stderr: 'pipe' });
let diagnostics = '';
transport.stderr?.on('data', data => { if (diagnostics.length < 16_000) diagnostics += data; });
try {
  await client.connect(transport);
  assert.equal(client.getServerVersion().version, manifest.version);
  const { tools } = await client.listTools();
  assert.ok(tools.some(tool => tool.name === 'apply_stashdock_tag_changes'));
  const open = tools.find(tool => tool.name === 'open_stashdock');
  const resource = await client.readResource({ uri: open._meta.ui.resourceUri });
  assert.ok(resource.contents[0].text.length > 100_000);
  const shelf = await client.callTool({ name: 'list_stashdock_shelf', arguments: {} });
  assert.equal(shelf.isError, undefined);
  assert.equal(shelf.structuredContent.count, 0);
  const found = await client.callTool({ name: 'search_stashdock', arguments: { query: '学习 ab' } });
  assert.equal(found.isError, undefined, 'Packaged search index is unavailable');
  const page = await client.callTool({ name: 'preview_stashdock_link', arguments: { url: 'https://example.org/' } }, undefined, { timeout: 120_000 });
  assert.equal(page.isError, undefined, JSON.stringify(page.content));
  assert.ok(page._meta?.preview?.title, 'Packaged native lookup did not return a title');
  const pdf = await client.callTool({ name: 'preview_stashdock_link', arguments: { url: 'https://arxiv.org/pdf/2505.22954' } }, undefined, { timeout: 120_000 });
  assert.equal(pdf.isError, undefined, JSON.stringify(pdf.content));
  assert.ok(pdf._meta.preview.title);
  assert.equal(pdf._meta.preview.content, '', 'PDF context must remain link-only');
  assert.ok(!pdf._meta.preview.preview, 'Foreground PDF lookup must not render a document');
  console.log(JSON.stringify({ plugin, version: manifest.version, filesVerified: manifest.files.length, bundledNode: manifest.node, pathEmpty: true, relativeCommand: true, stdio: true, uiBytes: resource.contents[0].text.length, isolatedCount: shelf.structuredContent.count, nativeLookup: page._meta.preview.title, nativePdf: pdf._meta.preview.title }));
} catch (error) {
  console.error(diagnostics); throw error;
} finally {
  await client.close();
  await rm(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
