import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { checkProvider } from '../extension/setup-client.js';
import { createBrowserLibrary } from '../extension/library-client.js';

test('browser save surface owns no settings UI and imports the shared circular control policy', () => {
  const form = readFileSync('src/features/browser-extension/Popup.tsx', 'utf8');
  assert.doesNotMatch(form, /SetupView|renderSetup|Settings|settingsOpen/);
  assert.match(form, /styles\/product-tokens\.css/);
  assert.match(form, /Check again/);
  for (const path of ['extension/setup.html', 'extension/setup.js', 'src/features/browser-extension/SetupView.tsx']) assert.equal(existsSync(path), false);
  const lifecycle = readFileSync('extension/sidepanel.js', 'utf8');
  for (const cleanup of ['unmount();', 'services.dispose();', 'disposeTooltips();', "theme.removeEventListener('change',applyTheme)", "document.removeEventListener('visibilitychange',services.wake)"]) assert.ok(lifecycle.includes(cleanup));
});

test('live sidebar checks only provider health, accepts either host and recovers without scanning integrations', async () => {
  const calls = [];
  const result = await checkProvider({ fetcher: async (url, options) => {
    calls.push([url, options]);
    if (url.includes('17864')) throw Error('AI plugin is not running');
    return { ok: true, json: async () => ({ ok: true, name: 'StashDock' }) };
  } });
  assert.deepEqual(result, { connected: true });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(([url, options]) => url.endsWith('/v1/health') && !options.method && !options.body && options.signal));
  assert.deepEqual(await checkProvider({ fetcher: async () => ({ ok: true, json: async () => ({ ok: true, name: 'Other app' }) }) }), { connected: false });
  assert.deepEqual(await checkProvider({ fetcher: async () => ({ ok: true, json: async () => ({ status: 'ready', app: 'StashDock library' }) }) }), { connected: true });
});

test('reading tags does not fetch the entire library when there are no pending operations', async () => {
  let data = {};
  const calls = [];
  const library = createBrowserLibrary({
    storage: { get: async () => structuredClone(data), set: async next => { data = structuredClone(next); } },
    fetcher: async url => { calls.push(url); return Response.json({ tags: ['Design'] }); },
  });
  await library.recoverPending();
  assert.deepEqual(await library.tags(), ['Design']);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].endsWith('/v1/tags'));
});

test('legacy pending changes are still recovered after a provider reconnects', async () => {
  const row = { id: 'one', url: 'https://example.org/post', title: 'Page', tags: [] };
  let data = { 'stashdock-library-v1': { items: [], imports: [row], deletes: [], edits: [] } };
  const calls = [];
  const library = createBrowserLibrary({
    storage: { get: async () => structuredClone(data), set: async next => { data = structuredClone(next); } },
    fetcher: async (url, options) => { calls.push(options.method || 'GET'); return Response.json(options.method === 'POST' ? { imported: 1,updated:0,skipped:0,total:1 } : { duplicate:null }); },
  });
  assert.equal((await library.recoverPending()).connected, true);
  assert.equal(data['stashdock-library-v1'].imports.length, 0);
  const count = calls.length;
  await library.recoverPending();
  assert.equal(calls.length, count);
});
