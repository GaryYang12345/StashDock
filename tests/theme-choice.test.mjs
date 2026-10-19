import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

test('visual themes are one native, controlled group with inert previews in both hosts', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const names = ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'];
  const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: name === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[name] });
  let root;
  try {
    const compiled = await build({ entryPoints: ['src/features/settings/ThemeChoice.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.module.css': 'empty' }, external: ['react', 'react-dom'] });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
    const { ThemeChoice } = module.exports;
    root = createRoot(document.getElementById('root'));
    const changes = [];
    async function render(props) { await act(async () => root.render(createElement(ThemeChoice, { value: 'light', host: false, onChange: value => changes.push(value), ...props }))); }
    await render();
    const radios = [...document.querySelectorAll('input[type="radio"]')];
    assert.equal(radios.length, 3);
    assert.equal(new Set(radios.map(node => node.name)).size, 1);
    assert.equal(document.querySelector('legend').textContent, 'Theme');
    assert.deepEqual(radios.map(node => node.value), ['light', 'dark', 'system']);
    assert.equal(radios[0].checked, true);
    assert.equal(document.querySelectorAll('[data-preview-theme="light"]').length, 2);
    assert.equal(document.querySelectorAll('[data-preview-theme="dark"]').length, 2);
    assert.equal(document.querySelectorAll('[data-mode="system"] > *').length, 2);
    assert.ok([...document.querySelectorAll('[data-mode]')].every(node => node.getAttribute('aria-hidden') === 'true'));
    await act(async () => radios[1].click());
    assert.deepEqual(changes, ['dark']);
    assert.equal(radios[0].checked, true, 'Only a persisted preference changes selection');
    await render({ value: 'dark', disabled: true });
    assert.equal(document.querySelector('fieldset').getAttribute('aria-disabled'), 'true');
    assert.ok([...document.querySelectorAll('input')].every(node => node.getAttribute('aria-disabled') === 'true'));
    await act(async () => document.querySelector('input[value="light"]').click());
    assert.deepEqual(changes, ['dark']);
    await render({ host: true, value: 'system' });
    assert.match(document.body.textContent, /Follow ChatGPT/);
    assert.doesNotMatch(document.body.textContent, /Follow system/);
    assert.equal(document.querySelector('input[value="system"]').checked, true);
  } finally {
    if (root) await act(async () => root.unmount());
    dom.window.close();
    for (const name of names) { const descriptor = originals.get(name); if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
});
