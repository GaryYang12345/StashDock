import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild');

// Bundle the real storage adapter with a scripted Tauri host.
async function loadStorage(tauri) {
  const stub = { name: 'tauri-stub', setup(b) {
    b.onResolve({ filter: /^@tauri-apps\// }, args => ({ path: args.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'module.exports = globalThis.__tauri;', loader: 'js' }));
  } };
  const result = await build({ stdin: { contents: "export * from './src/lib/storage';", resolveDir: root, loader: 'ts' },
    bundle: true, write: false, format: 'cjs', platform: 'neutral', plugins: [stub], logLevel: 'silent' });
  globalThis.__tauri = tauri;
  const module = { exports: {} };
  new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports);
  return module.exports;
}

function memoryStorage(entries = {}) {
  return { getItem: key => entries[key] ?? null, setItem: (key, value) => { entries[key] = value; } };
}

test('a fresh desktop library is initialized empty, never with demonstration references', async () => {
  const calls = [];
  globalThis.window = { localStorage: memoryStorage() };
  const storage = await loadStorage({ isTauri: () => true, invoke: async (name, args) => { calls.push([name, args]); return []; }, open: async () => null });
  await storage.loadItems();
  assert.deepEqual(calls[0], ['initialize_library', { items: [] }]);
  assert.equal(calls[1][0], 'list_items');
});

test('genuine legacy WebView references still migrate into the desktop library', async () => {
  const legacy = [{ id: 'kept', title: 'Kept', kind: 'web', source: 'Example', excerpt: '', tags: [], createdAt: '2026-01-01T00:00:00Z' }];
  const calls = [];
  globalThis.window = { localStorage: memoryStorage({ 'stashdock.items.v1': JSON.stringify(legacy) }) };
  const storage = await loadStorage({ isTauri: () => true, invoke: async (name, args) => { calls.push([name, args]); return []; }, open: async () => null });
  await storage.loadItems();
  assert.deepEqual(calls[0], ['initialize_library', { items: legacy }]);
});

test('the browser-only workbench keeps its demonstration shelf', async () => {
  globalThis.window = { localStorage: memoryStorage() };
  const storage = await loadStorage({ isTauri: () => false, invoke: async () => { throw Error('no host'); }, open: async () => null });
  assert.ok((await storage.loadItems()).length > 0);
});
