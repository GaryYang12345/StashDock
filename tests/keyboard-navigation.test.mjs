import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild');
const result = await build({ entryPoints: ['src/lib/keyboardNavigation.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' });
const module = { exports: {} };
new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports);
const { attachKeyboardNavigation, isFocusNavigationKey } = module.exports;

test('bare modifiers do not enable navigation focus; intentional keyboard navigation does', () => {
  for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'a', ',']) assert.equal(isFocusNavigationKey(key), false);
  for (const key of ['Tab', 'ArrowDown', 'Enter', ' ', 'Escape']) assert.equal(isFocusNavigationKey(key), true);
});

test('desktop focus modality resets on pointer, preserves keyboard focus on Shift and removes listeners', () => {
  const doc = new EventTarget(); doc.documentElement = { dataset: {} };
  const send = (type, properties = {}) => doc.dispatchEvent(Object.assign(new Event(type), properties));
  const detach = attachKeyboardNavigation(doc);
  assert.equal(doc.documentElement.dataset.desktopFocus, 'pointer');
  send('keydown', { key: 'Shift' }); assert.equal(doc.documentElement.dataset.desktopFocus, 'pointer');
  send('keydown', { key: 'Tab' }); assert.equal(doc.documentElement.dataset.desktopFocus, 'keyboard');
  send('keydown', { key: 'Shift' }); assert.equal(doc.documentElement.dataset.desktopFocus, 'keyboard');
  send('pointerdown'); assert.equal(doc.documentElement.dataset.desktopFocus, 'pointer');
  send('keydown', { key: 'Enter', isComposing: true }); assert.equal(doc.documentElement.dataset.desktopFocus, 'pointer');
  detach(); assert.equal(doc.documentElement.dataset.desktopFocus, undefined);
  send('keydown', { key: 'Tab' }); assert.equal(doc.documentElement.dataset.desktopFocus, undefined);
});
