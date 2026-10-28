import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { startCaptureBridge } from '../plugins/stashdock/server/capture-bridge.mjs';
import { createBrowserLibrary } from '../extension/library-client.js';
import { browserRegistration, safariExtensionId, safariNativeOrigin } from '../src/lib/browser-extension-identity.mjs';
import { browserInstallationRecord, registeredBrowserOrigin } from '../plugins/stashdock/server/integrations.mjs';

test('Safari native registration checks both identity and origin without browser profile access', () => {
  const record = browserInstallationRecord(() => null, 'safari', '0.4.20', safariExtensionId, safariNativeOrigin,
    () => assert.fail('Native authorization must not inspect browser profiles'));
  assert.equal(browserRegistration('safari', safariNativeOrigin, safariExtensionId), safariExtensionId);
  assert.equal(registeredBrowserOrigin(key => key === record.key ? record.value : null, safariNativeOrigin), true);
  for (const [id, origin] of [[safariExtensionId, safariNativeOrigin + '-other'], ['another.Extension', safariNativeOrigin],
    [safariExtensionId, 'https://example.org'], [safariExtensionId, 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
    [safariExtensionId, undefined]]) {
    assert.throws(() => browserRegistration('safari', origin, id));
    assert.throws(() => browserInstallationRecord(() => null, 'safari', '0.4.20', id, origin, () => false));
  }
});

test('Safari uses the real plugin bridge for registration, Save, duplicate choice and idempotent retry', async t => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-safari-plugin-'));
  const library = createLocalLibrary({ dataDir: root, browserEnabled: () => assert.fail('No profile access') });
  const bridge = startCaptureBridge(library, 0); await once(bridge, 'listening');
  t.after(async () => { await new Promise(resolve => bridge.close(resolve)); library.close(); rmSync(root, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${bridge.address().port}`;
  const headers = { 'Content-Type': 'application/json', 'X-StashDock-Client': 'chrome-extension-v1', Origin: safariNativeOrigin };
  assert.equal((await fetch(base + '/v1/health', { headers })).status, 200);
  const lookup = { method: 'POST', headers, body: JSON.stringify({ url: 'https://example.org/safari' }) };
  assert.equal((await fetch(base + '/v1/capture/lookup', lookup)).status, 403);
  const setup = await fetch(base + '/v1/setup', { method: 'POST', headers,
    body: JSON.stringify({ browser: 'safari', version: '0.4.20', extensionId: safariExtensionId }) });
  assert.equal(setup.status, 200); assert.equal((await setup.json()).connected, true);
  const client = createBrowserLibrary({ storage: { get: async () => ({}), set: async () => {} },
    fetcher: (url, options) => fetch(base + new URL(url).pathname, { ...options, headers: { ...options.headers, Origin: safariNativeOrigin } }) });
  const item = { id: 'draft', title: 'Safari original', kind: 'web', source: 'Example', url: 'https://example.org/safari',
    content: 'Captured content', excerpt: 'Captured content', tags: [], createdAt: '2026-10-26', origin: { importMethod: 'browser_extension' } };
  const options = { operationId: randomUUID() };
  const saved = await client.save(item, options);
  assert.equal(saved.saved, true); assert.deepEqual(await client.save(item, options), saved);
  const before = (await library.read())[0];
  const replacement = { ...item, title: 'Safari replacement' };
  const next = { operationId: randomUUID() };
  const conflict = await client.save(replacement, next);
  assert.equal(conflict.duplicate.id, before.id);
  assert.equal((await library.read())[0].title, before.title, 'unconfirmed replacement never mutates');
  assert.equal((await client.save(replacement, { ...next, replace: conflict.duplicate })).saved, true);
  const after = await library.read();
  assert.equal(after.length, 1); assert.equal(after[0].title, replacement.title);
  assert.equal(after[0].id, before.id); assert.equal(after[0].createdAt, before.createdAt);
  for (const origin of ['https://example.org', safariNativeOrigin + '-other']) {
    assert.equal((await fetch(base + '/v1/setup', { method: 'POST', headers: { ...headers, Origin: origin }, body: '{}' })).status, 403);
  }
});
