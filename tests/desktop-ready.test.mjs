import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';

test('native cold start gates child effects, retries failure and ignores late unmounted completions', async () => {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: 'http://ready.test/' });
  const values = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const original = new Map(Object.keys(values).map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries(values)) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  let root;
  try {
    const compiled = await build({ stdin: { contents: `
      import { createElement, useEffect } from 'react';
      import { DesktopReady } from './src/components/DesktopReady';
      export function Fixture({onMount}) {
        function Child() { useEffect(onMount,[]); return createElement('output',null,'ready'); }
        return createElement(DesktopReady,null,createElement(Child));
      }
    `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.css': 'empty', '.module.css': 'empty' }, external: ['react', 'react-dom', 'react-dom/client', '@tauri-apps/api/*'] });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
    const pending = [];
    mockIPC(command => {
      assert.equal(command, 'desktop_runtime_ready');
      return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    });
    let mounts = 0;
    root = createRoot(document.getElementById('root'));
    await act(async () => { root.render(createElement(module.exports.Fixture, { onMount: () => { mounts += 1; } })); });
    assert.equal(pending.length, 1);
    assert.equal(mounts, 0);
    assert.equal(document.querySelector('output'), null);
    await act(async () => { pending[0].reject('StashDock is still starting. Try again.'); });
    assert.match(document.body.textContent, /StashDock could not start/);
    await act(async () => { [...document.querySelectorAll('button')].find(button => button.textContent === 'Retry').click(); });
    assert.equal(pending.length, 2);
    assert.equal(mounts, 0);
    await act(async () => { pending[1].resolve(); });
    assert.equal(document.querySelector('output').textContent, 'ready');
    assert.equal(mounts, 1);
    await act(async () => { root.unmount(); });
    root = createRoot(document.getElementById('root'));
    await act(async () => { root.render(createElement(module.exports.Fixture, { onMount: () => { mounts += 1; } })); });
    await act(async () => { root.unmount(); }); root = undefined;
    await act(async () => { pending[2].resolve(); });
    assert.equal(mounts, 1);
  } finally {
    if (root) await act(async () => { root.unmount(); });
    clearMocks(); dom.window.close();
    for (const [name, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  }
});
