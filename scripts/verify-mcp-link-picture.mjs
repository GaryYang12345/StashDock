// Public lookup only, with an isolated database. No user-library mutations.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../plugins/stashdock/dist/mcp-server.mjs';
const server = createServer({ dataDir: mkdtempSync(join(resolve('output/playwright'), 'mcp-test-link-picture-')), previewWorker: false, htmlUrl: new URL('../plugins/stashdock/web/shelf.html', import.meta.url) });
const client = new Client({ name: 'Link picture regression', version: '1' });
const [a, b] = InMemoryTransport.createLinkedPair();
try {
  await server.connect(a); await client.connect(b);
  const lookup = () => client.callTool({ name: 'preview_stashdock_link', arguments: { url: 'https://www.deepseek.com/' } }, undefined, { timeout: 65_000 });
  const first = await lookup();
  assert.notEqual(first.isError, true, JSON.stringify(first.content));
  const picture = first._meta.preview;
  assert.match(picture.preview, /^data:image\//);
  assert.match(picture.faviconUrl, /^data:image\//);
  const start = performance.now(); const second = await lookup();
  assert.equal(second._meta.preview.preview, picture.preview);
  const cacheMs = Math.round(performance.now() - start);
  assert.ok(cacheMs < 1000, 'Repeated lookup started another renderer');
  console.log(JSON.stringify({ foregroundPicture: true, normalizedFavicon: true, sharedCachedPicture: true, cacheMs, userLibraryUntouched: true }));
} finally { await client.close(); await server.close(); }
