import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';

test('folder waits for native drag completion, blocks duplicate gestures, and only opens on a completed click', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://folder.test/' });
  const names = ['window', 'document', 'navigator', 'isTauri', 'IS_REACT_ACT_ENVIRONMENT'];
  const original = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, isTauri: true, IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  window.isTauri = true;
  let root;
  try {
    const compiled = await build({ stdin: { contents: `export {FloatingFolder} from './src/components/FloatingFolder';`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: ['react', 'react-dom', '@tauri-apps/api/*'], loader: { '.module.css': 'empty', '.svg': 'dataurl' } });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
    let complete, calls = 0, opened = 0, moved = 0;
    mockIPC(command => {
      if (command === 'folder_search_pointer' || command === 'plugin:event|unlisten') return;
      if (command === 'plugin:event|listen') return 1;
      assert.equal(command, 'drag_folder_window');
      calls++;
      return new Promise(resolve => { complete = resolve; });
    });
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(createElement(module.exports.FloatingFolder, { onOpen: () => { opened++; }, onMoved: () => { moved++; } })));
    const button = document.querySelector('button');
    const down = () => button.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0, screenX: 20, screenY: 30 }));
    await act(async () => { down(); down(); });
    assert.equal(calls, 1);
    assert.equal(opened, 0);
    await act(async () => complete(true));
    assert.equal(moved, 1);
    assert.equal(opened, 0);
    await act(async () => down());
    assert.equal(calls, 2);
    assert.equal(opened, 0);
    await act(async () => complete(false));
    assert.equal(opened, 1);
    await act(async () => button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, detail: 1 })));
    assert.equal(opened, 1, 'native pointer click must not open again after pointerdown completion');
  } finally {
    if (root) await act(async () => root.unmount());
    clearMocks(); dom.window.close();
    for (const name of names) {
      const descriptor = original.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  }
});
