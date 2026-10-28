import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { browserManifest, chromiumIdentity } from '../scripts/build-browser-extensions.mjs';
import { createBrowserHost } from '../extension/browser-host.js';
import { synchronizeActionBehavior } from '../extension/panel-behavior.js';
import { browserRegistration, firefoxExtensionId } from '../src/lib/browser-extension-identity.mjs';
import { browserExtensionDetected, firefoxAddonEnabled } from '../plugins/stashdock/server/browser-presence.mjs';
import { startCaptureBridge } from '../plugins/stashdock/server/capture-bridge.mjs';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';

const base = JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
test('Chromium identities follow their public keys across paths and stay out of Firefox and Safari', () => {
  const ids = new Set();
  for (const browser of ['chrome', 'edge']) {
    const identity = chromiumIdentity(browser);
    assert.match(identity.id, /^[a-p]{32}$/);
    ids.add(identity.id);
    assert.equal(browserManifest(base, browser).key, identity.publicKey);
    assert.equal(browserManifest(structuredClone(base), browser).key, identity.publicKey);
  }
  assert.deepEqual([...ids], ['bbglcpbhnobjhgccjinejnnlcefelkee', 'fgipdcmmnimccgdepghiecnngnakoeok'], 'Each browser uses its existing store identity on both operating systems');
  assert.equal(base.key, chromiumIdentity('chrome').publicKey);
  for (const browser of ['firefox', 'safari']) assert.equal(browserManifest(base, browser).key, undefined);
});
test('all browser packages share capture/UI code, optional website access and save-only scope', () => {
  const unchanged = structuredClone(base);
  for (const browser of ['chrome', 'edge', 'firefox']) {
    const manifest = browserManifest(base, browser);
    assert.deepEqual(manifest.host_permissions, base.host_permissions);
    assert.deepEqual(manifest.optional_host_permissions, ['<all_urls>']);
    assert.equal(manifest.incognito, 'not_allowed');
    for (const permission of ['cookies', 'debugger', 'tabs', 'bookmarks', 'history']) assert.ok(!manifest.permissions.includes(permission));
    assert.equal(manifest.action.default_popup, undefined);
    assert.equal(manifest.options_ui, undefined);
    if (browser === 'firefox') {
      assert.equal(manifest.background.service_worker, undefined);
      assert.deepEqual(manifest.background.scripts, ['background.js']);
      assert.equal(manifest.background.type, 'module');
      assert.equal(manifest.side_panel, undefined);
      assert.equal(manifest.sidebar_action.default_panel, 'sidepanel.html');
      assert.equal(manifest.sidebar_action.open_at_install, false);
      assert.equal(manifest.browser_specific_settings.gecko.id, firefoxExtensionId);
      assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, '153.0');
      assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ['websiteContent', 'browsingActivity']);
    } else { assert.deepEqual(manifest.background, base.background); assert.deepEqual(manifest.side_panel, base.side_panel); }
  }
  assert.deepEqual(base, unchanged);
  assert.throws(() => browserManifest(base, '../other'), /Unsupported/);
});

test('sidebar operations stay synchronous in the gesture and only the host adapter differs', async () => {
  for (const name of ['chrome', 'edge', 'firefox']) {
    const calls = [];
    const api = { runtime: { getManifest: () => browserManifest(base, name) },
      sidebarAction: { open: () => { calls.push('firefox-open'); return Promise.resolve(); }, close: () => Promise.resolve() },
      sidePanel: { open: value => { calls.push(value); return Promise.resolve(); }, close: () => Promise.resolve(), setPanelBehavior: async value => calls.push(value) } };
    if (name === 'firefox') delete api.sidePanel;
    const host = createBrowserHost(api, name === 'edge' ? 'Mozilla Edg/155.0' : 'Mozilla');
    assert.equal(host.name, name);
    const opened = host.open(8);
    assert.equal(calls.length, 1, 'Do not await before invoking the user-gesture API');
    assert.deepEqual(calls[0], name === 'firefox' ? 'firefox-open' : { windowId: 8 });
    await opened; await host.close(8); await synchronizeActionBehavior(api);
  }
});

test('Firefox registration distinguishes a profile origin UUID from its stable extension ID', () => {
  const origin = 'moz-extension://e9aefaf5-6844-473b-a647-9455e6346978';
  assert.equal(browserRegistration('firefox', origin, firefoxExtensionId), firefoxExtensionId);
  for (const [browser, source, id] of [['firefox', origin, 'other@addon'], ['firefox', 'chrome-extension://' + 'a'.repeat(32), firefoxExtensionId], ['chrome', origin, 'a'.repeat(32)], ['edge', 'chrome-extension://' + 'a'.repeat(32), 'b'.repeat(32)]]) assert.throws(() => browserRegistration(browser, source, id));
});

test('Firefox presence re-reads only its matching addon metadata after disable and uninstall', () => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-firefox-presence-'));
  try {
    mkdirSync(join(root, 'profile.default'));
    const path = join(root, 'profile.default/extensions.json');
    const addon = { id: firefoxExtensionId, defaultLocale: { name: 'StashDock Companion' }, active: true, userDisabled: false, appDisabled: false };
    const write = () => writeFileSync(path, JSON.stringify({ addons: [addon] }));
    const detect = () => browserExtensionDetected('firefox', firefoxExtensionId, { root });
    write(); assert.equal(detect(), true);
    addon.userDisabled = true; write(); assert.equal(detect(), false);
    addon.userDisabled = false; addon.active = false; write(); assert.equal(detect(), false);
    addon.active = true; addon.pendingUninstall = true; write(); assert.equal(detect(), false);
    assert.equal(firefoxAddonEnabled({ addons: [{ ...addon, id: 'other@addon' }] }, firefoxExtensionId), false);
    writeFileSync(path, '{broken'); assert.equal(detect(), false);
    rmSync(path); assert.equal(detect(), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the actual headless provider accepts Firefox/Edge and keeps foreign origins and invalid IDs out', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-mcp-test-browser-provider-'));
  const library = createLocalLibrary({ dataDir: root, browserEnabled: () => true }), server = startCaptureBridge(library, 0);
  await once(server, 'listening');
  try {
    const url = `http://127.0.0.1:${server.address().port}/v1/setup`;
    const request = (browser, origin, extensionId) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-StashDock-Client': 'chrome-extension-v1', Origin: origin }, body: JSON.stringify({ browser, version: base.version, extensionId }) });
    assert.equal((await request('firefox', 'moz-extension://e9aefaf5-6844-473b-a647-9455e6346978', firefoxExtensionId)).status, 200);
    assert.equal((await request('edge', 'chrome-extension://' + 'a'.repeat(32), 'a'.repeat(32))).status, 200);
    const edgeHeaders = { 'X-StashDock-Client': 'chrome-extension-v1', Origin: 'chrome-extension://' + 'a'.repeat(32) };
    assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/v1/tags`, { headers: edgeHeaders })).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/v1/tags`, { headers: { ...edgeHeaders, Origin: 'chrome-extension://' + 'b'.repeat(32) } })).status, 403);
    assert.equal((await request('firefox', 'https://evil.example', firefoxExtensionId)).status, 403);
    assert.equal((await request('firefox', 'moz-extension://e9aefaf5-6844-473b-a647-9455e6346978', 'other@addon')).status, 400);
    assert.equal((await library.read()).length, 0);
  } finally { await new Promise(resolve => server.close(resolve)); library.close(); rmSync(root, { recursive: true, force: true }); }
});
