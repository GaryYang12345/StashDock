// Read-only verification of the actual library, plus a consistent SQLite backup.
// Run after exiting StashDock to prove the shipped plugin needs no desktop API.
import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createLocalLibrary, dataDirectory } from '../plugins/stashdock/server/local-library.mjs';
const directory = dataDirectory();
const source = new DatabaseSync(join(directory, 'stashdock.sqlite3'), { readOnly: true });
const artifacts = resolve('artifacts'); mkdirSync(artifacts, { recursive: true });
const backupPath = join(artifacts, 'library-before-independent-20261010.sqlite3');
if (!existsSync(backupPath)) await backup(source, backupPath);
source.close();
try { await fetch('http://127.0.0.1:17863/v1/health', { signal: AbortSignal.timeout(1000) }); throw new Error('Exit the desktop app before independence verification.'); }
catch (error) { if (error.message.includes('Exit the desktop')) throw error; }
const local = createLocalLibrary(); const original = await local.read(); local.close();
const signature = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const before = signature(original);
const env = { ...process.env };
// Reproduce an already-running Windows host with a stale inherited environment.
// The shipped launcher must recover the existing user setting on its own.
if (process.platform === 'win32' && process.env.STASHDOCK_VERIFY_STALE_ENV === '1') delete env.STASHDOCK_DATA_DIR;
const pluginRoot = resolve(process.env.STASHDOCK_VERIFY_PLUGIN_ROOT || 'plugins/stashdock');
const transport = new StdioClientTransport({ command: process.execPath, args: ['scripts/mcp-server.mjs'], cwd: pluginRoot, env });
const client = new Client({ name: 'StashDock independent read verification', version: '1' });
try {
  await client.connect(transport);
  const shelf = await client.callTool({ name: 'list_stashdock_shelf', arguments: { limit: 50 } });
  if (shelf.isError || shelf.structuredContent.count !== Math.min(50, original.length)) throw new Error('Plugin count differs from the canonical library.');
  const bridge = await (await fetch('http://127.0.0.1:17864/v1/items', { headers: { 'X-StashDock-Client': 'chrome-extension-v1' } })).json();
  if (bridge.items.length !== original.length) throw new Error('Headless browser bridge count differs.');
  const after = createLocalLibrary(); let unchanged;
  try { unchanged = signature(await after.read()) === before; } finally { after.close(); }
  if (!unchanged) throw new Error('Library records changed during read-only verification.');
  console.log(JSON.stringify({ desktopStopped: true, pluginReadsCanonicalLibrary: true, browserUsesHeadlessBridge: true,
    references: original.length, recordsUnchanged: unchanged, backupPath }));
} finally { await client.close(); }
