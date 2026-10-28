// Operator-run integration fixture, never bundled into a product. Both browser
// providers and the exact packaged MCP server share one marked temporary DB.
import assert from 'node:assert/strict';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { join, basename, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

assert.equal(process.platform, 'darwin');
const directory = await realpath(resolve(process.argv[2] || ''));
const temporary = await realpath(tmpdir());
assert.ok(directory.startsWith(temporary + sep) && basename(directory).startsWith('stashdock-native-bridge-qa-'));
assert.equal(await readFile(join(directory, 'ISOLATED_QA'), 'utf8'), 'StashDock disposable acceptance library\n');
const standalone = process.argv.includes('--standalone');
if (!standalone) await readFile(join(directory, 'ready.json'));
const plugin = await realpath(resolve(process.argv[3] || ''));
const metadata = JSON.parse(await readFile(join(plugin, '.codex-plugin/plugin.json'), 'utf8'));
assert.equal(metadata.name, 'stashdock');
const { createServer } = await import(pathToFileURL(join(plugin, 'dist/mcp-server.mjs')));
// This operator fixture never competes with the user's live MCP bridge.
const captureBridgePort = Number(process.argv[4] || 17865);
assert.ok(Number.isInteger(captureBridgePort) && captureBridgePort >= 1024 && captureBridgePort <= 65535 && captureBridgePort !== 17864 && (captureBridgePort !== 17863 || standalone));
const server = createServer({ dataDir: directory, captureBridge: true, captureBridgePort, previewWorker: false, htmlUrl: pathToFileURL(join(plugin, 'web/shelf.html')) });
const [hostTransport, transport] = InMemoryTransport.createLinkedPair();
await server.connect(hostTransport);
const client = new Client({ name: 'stashdock-owned-mac-capture-qa', version: '1' });
await client.connect(transport);
const tools = await client.listTools();
await writeFile(join(directory, 'mcp-ready.json'), JSON.stringify({ version: metadata.version, tools: tools.tools.length, directory, plugin, captureBridgePort, nativeRouterRequired: !standalone }));
console.log(JSON.stringify({ ready: true, version: metadata.version, tools: tools.tools.length, directory, captureBridgePort }));
const lines = createInterface({ input: process.stdin });
let closing = false;
async function close() {
  if (closing) return;
  closing = true; clearTimeout(deadline); lines.close();
  await client.close(); await server.close();
}
const deadline = setTimeout(() => { void close(); }, 600_000);
process.once('SIGINT', () => { void close(); });
process.once('SIGTERM', () => { void close(); });
const allowed = new Set(['search_stashdock', 'get_stashdock_items', 'list_stashdock_tags', 'save_stashdock_reference', 'edit_stashdock_context', 'set_stashdock_favorite']);
try {
  for await (const line of lines) {
    let request;
    try {
      assert.ok(line.length < 32_000);
      request = JSON.parse(line);
      if (request.name === 'stop') break;
      assert.ok(allowed.has(request.name));
      const result = await client.callTool({ name: request.name, arguments: request.arguments || {} });
      await writeFile(join(directory, 'last-mcp-result.json'), JSON.stringify(result));
      const data = result.structuredContent || result.content;
      console.log(JSON.stringify({ id: request.id, isError: result.isError || false, data }).slice(0, 6000));
    } catch (error) { console.log(JSON.stringify({ id: request?.id, error: String(error) })); }
  }
} finally { await close(); }
