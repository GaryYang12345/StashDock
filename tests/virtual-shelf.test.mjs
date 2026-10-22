import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

test('the shelf mounts only rows near the viewport and swaps results in one render', async () => {
  const dom = new JSDOM('<html><body><div id="scroller" style="height:900px;overflow:auto"><div id="root"></div></div></body></html>');
  const names = ['window', 'document', 'getComputedStyle', 'ResizeObserver', 'IS_REACT_ACT_ENVIRONMENT'];
  const original = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const values = { window: dom.window, document: dom.window.document, getComputedStyle: dom.window.getComputedStyle.bind(dom.window), ResizeObserver: class { observe() {} unobserve() {} disconnect() {} }, IS_REACT_ACT_ENVIRONMENT: true };
  for (const name of names) Object.defineProperty(globalThis, name, { value: values[name], configurable: true, writable: true });
  let root;
  try {
    const compiled = await build({ stdin: { contents: `
      import { createElement } from 'react';
      import { VirtualShelf } from './src/features/library/VirtualShelf';
      export function Shelf({ items, scroller, view = 'grid', resetKey = '' }) { return createElement(VirtualShelf, { items, view, scroller, gridClassName: 'grid', listClassName: 'list', resetKey }, item => createElement('article', { key: item, 'data-id': item }, item)); }
    `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: ['react', 'react-dom'], plugins: [{ name: 'css-modules', setup(b) { b.onLoad({ filter: /\.css$/ }, () => ({ contents: 'export default new Proxy({}, { get: (_, key) => String(key) });', loader: 'js' })); } }] });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
    const { Shelf } = module.exports;
    const scroller = document.getElementById('scroller');
    // jsdom has no layout: give the viewport a real size.
    scroller.getBoundingClientRect = () => ({ top: 0, left: 0, right: 1000, bottom: 900, width: 1000, height: 900, x: 0, y: 0 });
    Object.defineProperty(scroller, 'offsetHeight', { value: 900 }); Object.defineProperty(scroller, 'offsetWidth', { value: 1000 });
    const ids = () => [...document.querySelectorAll('article')].map(node => node.dataset.id);
    const all = Array.from({ length: 600 }, (_, i) => `r${i}`);
    root = createRoot(document.getElementById('root'));
    await act(async () => { root.render(createElement(Shelf, { items: all, scroller })); });
    const shown = ids();
    assert.ok(shown.length > 0 && shown.length < 60, `bounded mount: ${shown.length}`);
    assert.deepEqual(shown, all.slice(0, shown.length), 'rows keep result order');
    const matches = all.filter((_, i) => i % 120 === 0);
    await act(async () => { root.render(createElement(Shelf, { items: matches, scroller, resetKey: 'q' })); });
    assert.deepEqual(ids(), matches);
    await act(async () => { root.render(createElement(Shelf, { items: all, scroller, view: 'list', resetKey: '' })); });
    assert.ok(ids().length > 0 && ids().length < 60);
  } finally {
    await act(async () => root?.unmount());
    for (const [name, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
});
