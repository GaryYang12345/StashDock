// Actual packaged MCP lookup against a public PDF. No user-library writes.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../plugins/stashdock/dist/mcp-server.mjs';
const root = resolve('output/playwright');
mkdirSync(root, { recursive: true });
const dataDir = mkdtempSync(join(root, 'mcp-test-pdf-'));
const server = createServer({ dataDir, previewWorker: false, htmlUrl: new URL('../plugins/stashdock/web/shelf.html', import.meta.url) });
const client = new Client({ name: 'PDF lookup regression', version: '1' });
const [a, b] = InMemoryTransport.createLinkedPair();
try {
  await server.connect(a); await client.connect(b);
  const result = await client.callTool({ name: 'preview_stashdock_link', arguments: { url: 'https://arxiv.org/pdf/2505.22954' } }, undefined, { timeout: 65_000 });
  assert.notEqual(result.isError, true, JSON.stringify(result.content));
  const data = result._meta.preview;
  assert.match(data.title, /Darwin|G[oö]del/i);
  assert.ok(data.content.length > 10_000);
  assert.match(data.preview, /^data:image\/jpeg;base64,/);
  console.log(JSON.stringify({ packagedMcpPdf: true, title: data.title, contentCharacters: data.content.length, previewBytes: data.preview.length, userLibraryUntouched: true }));
} finally { await client.close(); await server.close(); }
