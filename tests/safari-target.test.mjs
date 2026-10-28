import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { browserManifest } from '../scripts/build-browser-extensions.mjs';
import { createBrowserHost } from '../extension/browser-host.js';
import { createSafariFetcher } from '../extension/safari-provider.js';

test('Safari reuses the Save popup without unsupported sidebar or worker manifest keys', async () => {
  const base = JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
  const manifest = browserManifest(base, 'safari');
  assert.equal(manifest.action.default_popup, 'sidepanel.html');
  assert.deepEqual(manifest.background, { scripts: ['background.js'] });
  assert.ok(manifest.permissions.includes('nativeMessaging'));
  for (const permission of ['sidePanel', 'cookies', 'debugger', 'tabs', 'bookmarks', 'history']) assert.ok(!manifest.permissions.includes(permission));
  assert.equal(manifest.side_panel, undefined);
  assert.equal(manifest.incognito, undefined);
  assert.equal(manifest.host_permissions, undefined);
  const host = createBrowserHost({ runtime: { getManifest: () => manifest } });
  assert.equal(host.name, 'safari');
  await host.open(1); await host.close(1);
  assert.equal(base.action.default_popup, undefined);
});

test('Safari native transport exposes only bounded current-page provider requests', async () => {
  const calls = [];
  const fetcher = createSafariFetcher({ runtime: { sendNativeMessage: async (id, message) => {
    calls.push({ id, message });
    return { status: 200, body: JSON.stringify({ saved: true }) };
  } } });
  const response = await fetcher('http://127.0.0.1:17863/v1/capture', { method: 'POST', body: '{"title":"Test"}' });
  assert.deepEqual(await response.json(), { saved: true });
  assert.deepEqual(calls[0], { id: 'app.stashdock.desktop', message: { method: 'POST', path: '/v1/capture', body: '{"title":"Test"}', port: 17863 } });
  for (const url of ['https://example.com/v1/capture', 'http://127.0.0.1:9999/v1/capture', 'http://user:secret@127.0.0.1:17863/v1/capture', 'http://127.0.0.1:17863/v1/items']) {
    await assert.rejects(fetcher(url), /Invalid StashDock/);
  }
  await assert.rejects(fetcher('http://127.0.0.1:17863/v1/capture', { method: 'POST', body: 'x'.repeat(1_000_001) }), /Invalid/);
  await assert.rejects(fetcher('http://127.0.0.1:17863/v1/health', { signal: AbortSignal.abort() }), /cancelled/);
  assert.equal(calls.length, 1);
});
