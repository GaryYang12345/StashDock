import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { locateLibrary, markLibraryReady } from '../plugins/stashdock/server/canonical-library.mjs';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { checkSetup, createSetupConnection } from '../extension/setup-client.js';
import { startCaptureBridge } from '../plugins/stashdock/server/capture-bridge.mjs';
import { once } from 'node:events';
import { readIntegrations, configuredCodexPlugin, codexPluginDetected, browserInstallationRecord } from '../plugins/stashdock/server/integrations.mjs';
import { build } from 'esbuild';
import { zh } from '../src/features/settings/messages.mjs';
import { browserExtensionDetected, extensionEnabled } from '../plugins/stashdock/server/browser-presence.mjs';

test('browser registration requires the exact enabled StashDock extension', () => {
  const id = 'a'.repeat(32), origin = `chrome-extension://${id}`;
  assert.throws(
    () => browserInstallationRecord(() => undefined, 'chrome', '0.4.13', id, origin, () => false),
    /Invalid StashDock extension/,
  );
  assert.doesNotThrow(
    () => browserInstallationRecord(() => undefined, 'chrome', '0.4.13', id, origin, (browser, candidate) => browser === 'chrome' && candidate === id),
  );
});

test('one per-user anchor wins independent installation locations and fails closed if its database disappears', t => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-anchor-test-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const a = join(root, 'a'), b = join(root, 'b'), registry = join(root, 'registration', 'library-root-v1.json');
  const first = locateLibrary(a, registry);
  assert.equal(first.anchor, a); assert.equal(first.initialized, false);
  assert.equal(locateLibrary(b, registry).anchor, a);
  const raw = JSON.parse(readFileSync(registry)); raw.registry = join(root, 'must-not-write.json'); writeFileSync(registry, JSON.stringify(raw));
  assert.equal(locateLibrary(b, registry).registry, registry);
  mkdirSync(a); writeFileSync(join(a, 'stashdock.sqlite3'), 'original'); markLibraryReady(first);
  assert.equal(locateLibrary(b, registry).anchor, a);
  assert.equal(JSON.parse(readFileSync(registry)).initialized, true);
  rmSync(join(a, 'stashdock.sqlite3'));
  assert.throws(() => locateLibrary(b, registry), /unavailable/);
  writeFileSync(registry, '{broken'); assert.throws(() => locateLibrary(b, registry));
});
test('companion detection reads only StashDock registrations and does not confuse a missing file with installed', t => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-integration-test-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const previous = process.env.CODEX_HOME; process.env.CODEX_HOME = root;
  t.after(() => { if (previous === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = previous; });
  const library = createLocalLibrary({ dataDir: root });
  try {
    const path = join(root, 'own-plugin.json'); writeFileSync(path, '{}');
    library.registerInstallation('codex', '0.4.27', path); library.registerInstallation('chrome', '0.4.9');
    const states = library.integrations();
    // A leftover manifest alone is not an enabled installation.
    assert.equal(states.items.find(x => x.id === 'codex').detected, false);
    assert.equal(states.items.find(x => x.id === 'chrome').detected, false);
    assert.equal(states.items.find(x => x.id === 'desktop').detected, false);
    rmSync(path); assert.equal(library.integrations().items.find(x => x.id === 'codex').detected, false);
    assert.throws(() => library.registerInstallation('../arbitrary', '1'));
    assert.throws(() => library.registerInstallation('chrome', 'bad value'));
  } finally { library.close(); }
});
test('Codex detection re-reads enabled configuration and rejects uninstall/disable while the cached package remains', t => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-codex-presence-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const manifest = join(root, 'plugins', 'cache', 'personal', 'stashdock', '1', '.codex-plugin', 'plugin.json');
  mkdirSync(join(manifest, '..'), { recursive: true }); writeFileSync(manifest, '{}');
  const config = join(root, 'config.toml');
  const enabled = '[plugins."stashdock@personal"]\nenabled = true';
  const detect = () => readIntegrations(key => key === 'installation_codex_v1' ? JSON.stringify({ version: '1', path: manifest }) : null, { codexEnabled: path => codexPluginDetected(path, { home: root }) }).items.find(item => item.id === 'codex').detected;
  assert.equal(detect(), false);
  writeFileSync(config, enabled); assert.equal(detect(), true);
  writeFileSync(config, '[plugins."stashdock@personal"]\nenabled = false'); assert.equal(detect(), false);
  writeFileSync(config, enabled + '\n[plugins."stashdock@personal".mcp_servers.stashdock]\nenabled=false'); assert.equal(detect(), false);
  writeFileSync(config, enabled); assert.equal(detect(), true);
  writeFileSync(config, ''); assert.equal(detect(), false);
  assert.ok(readFileSync(manifest));
  assert.equal(configuredCodexPlugin('[plugins."stashdock@other"]\nenabled=true', manifest), false);
  assert.equal(configuredCodexPlugin('[broken', manifest), false);
});
test('extension discovers either local provider, accepts legacy health, and reports missing services honestly', async () => {
  const calls = [];
  const request = async url => { calls.push(url); return url.includes('17863') ? { ok: true, json: async () => ({ connected: true, owner: 'desktop', integrations: { items: [] } }) } : { ok: false }; };
  assert.equal((await checkSetup({ fetcher: request })).owner, 'desktop');
  assert.ok(calls.every(url => /^http:\/\/127\.0\.0\.1:(17863|17864)\/v1\/(setup|health)$/.test(url)));
  assert.equal((await checkSetup({ fetcher: async () => { throw Error('offline'); } })).connected, false);
  const legacy = await checkSetup({ fetcher: async url => ({ ok: url.endsWith('health'), json: async () => ({ status: 'ready', app: 'StashDock library' }) }) });
  assert.equal(legacy.connected, true);
});

test('a legacy provider cannot hide a setup-capable provider, and parallel checks share one request', async () => {
  const calls = [];
  const fetcher = async url => {
    calls.push(url);
    if (url.includes('17863')) return { ok: true, json: async () => ({ connected: true, owner: 'desktop', integrations: { items: [{ id: 'chrome', detected: true }] } }) };
    return { ok: url.endsWith('health'), json: async () => ({ status: 'ready', app: 'StashDock library' }) };
  };
  const setup = createSetupConnection({ fetcher });
  const first = setup(), second = setup(); assert.equal(first, second);
  assert.equal((await first).owner, 'desktop');
  assert.equal(calls.filter(url => url.includes('17863')).length, 1);
  await setup(); assert.equal(calls.filter(url => url.includes('17863')).length, 2);
});

test('an old browser handshake alone never proves an extension is still enabled', () => {
  const status = readIntegrations(key => key === 'installation_chrome_v1' ? JSON.stringify({ version: '0.4.10', seenAt: Date.now() - 60 * 86400000 }) : null);
  assert.equal(status.items.find(value => value.id === 'chrome').detected, false);
});
test('browser detection follows only the registered extension, including disable and removal', t => {
  const root=mkdtempSync(join(tmpdir(),'stashdock-browser-presence-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  mkdirSync(join(root,'Default')); const id='a'.repeat(32), path=join(root,'Default','Secure Preferences');
  const record={extensions:{settings:{[id]:{manifest:{name:'StashDock Companion'},state:1,disable_reasons:[]}}}};
  const detect=()=>browserExtensionDetected('chrome',id,{root});
  writeFileSync(path,JSON.stringify(record));assert.equal(detect(),true);
  record.extensions.settings[id].disable_reasons=[1];writeFileSync(path,JSON.stringify(record));assert.equal(detect(),false);
  record.extensions.settings[id].disable_reasons=[];writeFileSync(path,JSON.stringify(record));assert.equal(detect(),true);
  delete record.extensions.settings[id].state;delete record.extensions.settings[id].disable_reasons;
  writeFileSync(path,JSON.stringify(record));assert.equal(detect(),true);
  const unpacked=join(root,'unpacked');mkdirSync(unpacked);writeFileSync(join(unpacked,'manifest.json'),JSON.stringify({name:'StashDock Companion'}));
  delete record.extensions.settings[id].manifest;record.extensions.settings[id].path=unpacked;
  writeFileSync(path,JSON.stringify(record));assert.equal(detect(),true);
  delete record.extensions.settings[id];writeFileSync(path,JSON.stringify(record));assert.equal(detect(),false);
  writeFileSync(join(root,'Default','Preferences'),JSON.stringify({extensions:{settings:{[id]:{manifest:{name:'StashDock Companion'},state:1}}}}));
  assert.equal(detect(),false,'Secure Preferences removal must beat an old legacy entry');
  assert.equal(extensionEnabled({extensions:{settings:{[id]:{manifest:{name:'Other app'},state:1}}}},id),false);
  assert.equal(browserExtensionDetected('chrome','../../other',{root}),false);
});
test('host-specific sections keep browsers separate from AI plugins and do not advertise competitors inside Codex', () => {
  const source = readFileSync('src/features/settings/IntegrationSections.tsx', 'utf8');
  assert.match(source, /: \[\{ title: 'Browser extensions', ids: browsers \}, \{ title: 'Desktop app'/);
  assert.doesNotMatch(source, /'browser'/);
  assert.match(source, /!entry.ready && <span[^>]*>\{t\('Coming soon'\)\}/);
  assert.doesNotMatch(readFileSync('src/features/mcp-app/McpSettingsView.tsx', 'utf8'), /Shared with the desktop app/);
  const worker = readFileSync('extension/background.js', 'utf8');
  assert.doesNotMatch(worker, /setup\.html|open-integration/);
  assert.match(worker, /return library.save\(item/);
  assert.match(readFileSync('extension/library-client.js','utf8'), /Open the latest StashDock Desktop or AI plugin, then retry/);
});
test('settings explanations reuse shared tooltips with a normal pointer and detected integrations open usage guides', () => {
  const help = readFileSync('src/features/settings/SettingHelp.tsx', 'utf8');
  assert.match(help, /<button type="button"/);
  assert.match(help, /aria-label=\{label\} data-tooltip=\{children\}/);
  assert.doesNotMatch(help, /Popover|onClick|title=/);
  const integrations = readFileSync('src/features/settings/IntegrationSections.tsx', 'utf8');
  assert.match(integrations, /<SettingHelp label=\{t\('About \{section\}'/);
  assert.match(integrations, /state\?\.detected \? 'View guide' : 'Set up'/);
  assert.match(integrations, /data-detected>\{t\('Detected'\)\}/);
  assert.match(integrations, /kind: entry.ready && state\?\.detected \? 'usage' : 'setup'/);
  assert.match(readFileSync('src/features/settings/IntegrationGuide.tsx','utf8'), /steps\.map/);
  assert.match(integrations, /className=\{styles.actions\}>\{entry.ready && state\?\.detected/);
  assert.doesNotMatch(integrations, /Configured|In use|styles\.purpose|disabled=\{disabled \|\| state\?\.detected\}/);
  const css = readFileSync('src/features/settings/SettingsView.module.css', 'utf8');
  assert.match(css, /\.helpButton \{[^}]*cursor: pointer/);
  assert.doesNotMatch(css, /cursor: help/);
  assert.match(readFileSync('src/features/settings/IntegrationSections.module.css', 'utf8'), /list-style-type: decimal/);
});

test('approved purpose copy and complete localized guides cover every implemented integration', async () => {
  const result = await build({ entryPoints: ['src/features/settings/integrations.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
  const { integrationCatalog, integrationGuides } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
  assert.equal(integrationCatalog.chrome.purpose, 'Save pages while you browse.');
  assert.equal(integrationCatalog.codex.purpose, 'Browse your library and use references as context in conversations.');
  assert.equal(integrationGuides.codex.description, integrationCatalog.codex.purpose);
  assert.equal(integrationGuides.desktop.description, integrationCatalog.codex.purpose);
  assert.equal(integrationCatalog.desktop.purpose, 'Browse and manage your references visually in a standalone desktop app. Bring them into any AI app.');
  for (const [id, entry] of Object.entries(integrationCatalog)) {
    assert.ok(zh[entry.purpose], `Missing purpose translation: ${id}`);
    if (!entry.ready) continue;
    const guide = integrationGuides[id];
    assert.equal(guide.steps.length, 3);
    for (const text of [guide.title, guide.description, ...guide.steps]) assert.ok(zh[text], `Missing guide translation: ${text}`);
    assert.ok(!guide.steps.some(step => /^Install/.test(step)), `Usage guide is an installation guide: ${id}`);
  }
});

test('an actual extension setup handshake registers against the provider library without accepting website callers', async t => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-setup-bridge-test-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const library = createLocalLibrary({ dataDir: root, browserEnabled: () => true }), server = startCaptureBridge(library, 0);
  try {
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/v1/setup`;
    const headers = { 'content-type': 'application/json', 'x-stashdock-client': 'chrome-extension-v1', origin: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ browser: 'chrome', version: '0.4.9' }) });
    assert.equal(response.status, 200); assert.equal((await response.json()).connected, true);
    // Registration identifies this extension, but the synthetic ID is not
    // installed in a real browser and must not be called Detected.
    assert.equal(library.integrations().items.find(v => v.id === 'chrome').detected, false);
    assert.equal((await fetch(url, { method: 'POST', headers: { ...headers, origin: 'https://untrusted.example' }, body: '{}' })).status, 403);
    assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify({ browser:'chrome',version:'1',extensionId:'b'.repeat(32) }) })).status,400);
    assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify({ browser: 'desktop', version: '1' }) })).status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); library.close(); }
});
