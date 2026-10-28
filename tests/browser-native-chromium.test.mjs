// Opt-in installed-browser regression. Never attaches to a user's browser or
// library. Supply STASHDOCK_TEST_CHROMIUM and STASHDOCK_PLAYWRIGHT_MODULE.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const executablePath = process.env.STASHDOCK_TEST_CHROMIUM;
const playwrightModule = process.env.STASHDOCK_PLAYWRIGHT_MODULE;
test('installed Chromium launches both registered savers and commits with HTTP forbidden', {
  skip: process.platform !== 'win32' || !executablePath || !playwrightModule,
  timeout: 60000,
}, async () => {
  const { chromium } = await import(pathToFileURL(resolve(playwrightModule)).href);
  const root = mkdtempSync(join(tmpdir(), 'stashdock-native-browser-test-'));
  const extension = join(root, 'extension');
  cpSync(resolve('extension'), extension, { recursive: true });
  writeFileSync(join(extension, 'native-probe.html'), '<!doctype html><script type="module" src="native-probe.js"></script>');
  writeFileSync(join(extension, 'native-probe.js'), `
    import { createNativeClient } from './native-client.js';
    import { createBrowserLibrary } from './library-client.js';
    import { checkProvider } from './setup-client.js';
    window.runNativeProbe = async () => {
      let httpCalls = 0;
      const fetcher = () => { httpCalls++; throw Error('HTTP providers are forbidden in this test'); };
      const failures = [];
      const api = (globalThis.browser ?? globalThis.chrome).runtime;
      const runtime = { get lastError() { return api.lastError; }, connectNative(host) {
        const port = api.connectNative(host);
        port.onDisconnect.addListener(() => { const error = chrome.runtime.lastError?.message; if (error) failures.push({ host, error }); });
        port.onMessage.addListener(message => { if (!message.ok) failures.push({ host, error: message.error }); });
        return port;
      } };
      const native = createNativeClient(runtime);
      const provider = await checkProvider({ native, fetcher });
      const results = [];
      for (const host of ['app.stashdock.desktop', 'app.stashdock.plugin']) {
        const base = 'native:' + host;
        const selected = { at: native.at, query: async (path, body) => ({ base, value: await native.at(base, path, body) }) };
        const client = createBrowserLibrary({ native: selected, storage: chrome.storage.local, fetcher });
        const item = { id: 'draft', title: host, kind: 'web', source: 'Example',
          url: 'https://example.org/' + host, content: 'Browser-owned independent save fixture.',
          excerpt: '', tags: ['Native browser test'], createdAt: new Date().toISOString(), favorite: false };
        const options = { operationId: crypto.randomUUID() };
        const saved = await client.save(item, options);
        const retried = await client.save(item, options);
        results.push({ host, saved, retried, tags: await client.tags() });
      }
      return { provider, results, httpCalls, failures };
    };
  `);
  let context;
  try {
    context = await chromium.launchPersistentContext(join(root, 'browser'), {
      executablePath, headless: true, ignoreDefaultArgs: ['--disable-extensions'],
      // Development-only CDP extension loading, scoped to this disposable profile.
      // No daily-browser flags, permissions or registry entries are changed.
      args: ['--enable-unsafe-extension-debugging'],
      env: { ...process.env, APPDATA: join(root, 'profile'), STASHDOCK_DATA_DIR: join(root, 'library') },
    });
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: extension });
    const page = await context.newPage();
    await page.goto('chrome-extension://' + id + '/native-probe.html');
    await page.waitForFunction(() => typeof window.runNativeProbe === 'function');
    const result = await page.evaluate(() => window.runNativeProbe());
    assert.deepEqual(result.provider, { connected: true }, JSON.stringify(result.failures));
    assert.equal(result.httpCalls, 0);
    for (const entry of result.results) {
      assert.equal(entry.saved.saved, true, entry.host);
      assert.deepEqual(entry.retried, entry.saved, 'explicit retry resolves the same durable receipt');
      assert.deepEqual(entry.tags, ['Native browser test']);
    }
    const db = new DatabaseSync(join(root, 'library', 'stashdock.sqlite3'), { readOnly: true });
    try { assert.equal(db.prepare('SELECT count(*) AS n FROM stash_items').get().n, 2); }
    finally { db.close(); }
  } finally {
    await context?.close();
    rmSync(root, { recursive: true, force: true });
  }
});
