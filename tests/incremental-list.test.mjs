import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

test('long shelves mount in chunks and a changed list keeps the cards already shown', async () => {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>');
  const names = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'];
  const original = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const values = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  for (const name of names) Object.defineProperty(globalThis, name, { value: values[name], configurable: true, writable: true });
  let root;
  try {
    const compiled = await build({ stdin: { contents: `
      import { createElement } from 'react';
      import { useIncrementalList } from './src/features/library/useIncrementalList';
      export function List({ items, commits }) { const shown = useIncrementalList(items, 10); commits.push(shown.length); return createElement('ul', null, shown.map(id => createElement('li', { key: id, id }, id))); }
    `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: ['react'] });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
    const { List } = module.exports;
    const all = Array.from({ length: 35 }, (_, i) => `r${i}`), narrow = all.filter((_, i) => i % 5 === 0);
    const commits = [];
    const settle = () => act(() => new Promise(done => setTimeout(done, 30)));
    root = createRoot(document.getElementById('root'));
    await act(async () => { root.render(createElement(List, { items: all, commits })); });
    assert.equal(commits[0], 10, 'first commit holds one chunk');
    for (let i = 0; i < 5; i++) await settle();
    assert.equal(document.querySelectorAll('li').length, 35);
    assert.ok(commits.every(count => count <= 35) && new Set(commits).size >= 4, `grew in chunks: ${commits}`);
    // Narrowing shows every match at once.
    await act(async () => { root.render(createElement(List, { items: narrow, commits })); });
    assert.equal(document.querySelectorAll('li').length, narrow.length);
    // Broadening keeps what was shown, then adds the rest in chunks.
    const kept = document.getElementById('r0');
    commits.length = 0;
    await act(async () => { root.render(createElement(List, { items: all, commits })); });
    assert.equal(document.querySelectorAll('li').length, 10);
    assert.equal(document.getElementById('r0'), kept, 'an already shown card is not remounted');
    for (let i = 0; i < 5; i++) await settle();
    assert.equal(document.querySelectorAll('li').length, 35);
  } finally {
    await act(async () => root?.unmount());
    for (const [name, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
});
