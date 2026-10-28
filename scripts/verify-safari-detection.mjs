// Read the real system's own-extension state through a packaged MCP server.
// Only the test library is opened; the containing Desktop runs its status mode.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { pathToFileURL } from 'node:url';
if (process.platform !== 'darwin') throw Error('Run the real Safari state check on macOS.');
const expected = process.argv[2];
if (!['enabled','disabled'].includes(expected)) throw Error('Usage: node scripts/verify-safari-detection.mjs enabled|disabled [--open-safari]');
const root = resolve(import.meta.dirname, '..');
const plugin = resolve(root, 'output/plugin-build/darwin-arm64/plugins/stashdock');
const desktop = resolve(root, '../outputs/StashDock.app/Contents/MacOS/stashdock');
const scratch = await mkdtemp(join(tmpdir(), 'stashdock-safari-status-'));
const library = join(scratch, 'library');
await mkdir(library);
const db = new DatabaseSync(join(library,'stashdock.sqlite3'));
db.exec(await readFile(join(plugin,'server/schema.sql'),'utf8'));
db.prepare('INSERT INTO app_meta(key,value) VALUES (?,?)').run('installation_desktop_v1',JSON.stringify({version:'0.2.5',path:desktop}));
// Keep the real Mac user environment for SafariServices, but explicitly inject
// only the isolated library. A fake HOME tests a different preference context.
const { createServer } = await import(pathToFileURL(join(plugin,'dist/mcp-server.mjs')).href);
const server = createServer({ dataDir:library, htmlUrl:pathToFileURL(join(plugin,'web/shelf.html')) });
const [serverTransport, transport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);
const client = new Client({name:'safari-status-verification',version:'1'});
const samples=[];
try {
  await client.connect(transport);
  const tools=await client.listTools();
  assert.ok(tools.tools.find(tool=>tool.name==='open_stashdock_integration').inputSchema.properties.id.enum.includes('safari'));
  for(let i=0;i<3;i++) {
    const start=performance.now();
    const result=await client.callTool({name:'get_stashdock_integrations',arguments:{}});
    assert.notEqual(result.isError,true,JSON.stringify(result));
    const info=result._meta.integrations;
    assert.equal(info.platform,'macos');
    const safari=info.items.find(item=>item.id==='safari');
    assert.equal(safari.detected,expected==='enabled');
    assert.equal(JSON.stringify(result.content).includes(library),false);
    samples.push({detected:safari.detected,elapsedMs:Math.round(performance.now()-start)});
  }
  if(process.argv.includes('--open-safari')) {
    const result=await client.callTool({name:'open_stashdock_integration',arguments:{id:'safari'}});
    assert.notEqual(result.isError,true,JSON.stringify(result));
    assert.equal(result.structuredContent.opened,true);
  }
  assert.equal(db.prepare('SELECT COUNT(*) n FROM stash_items').get().n,0);
  console.log(JSON.stringify({expected,samples,openedSafari:process.argv.includes('--open-safari'),isolatedLibraryUnchanged:true,scratch},null,2));
} finally { await client.close();await server.close();db.close(); }
