import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { mockIPC, mockWindows, clearMocks } from '@tauri-apps/api/mocks';

test('login approval refresh reflects OS changes and cannot undo a later explicit disable', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://fixture.test/' });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), isTauri: true, IS_REACT_ACT_ENVIRONMENT: true };
  const originals = new Map(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  let root;
  try {
    const compiled = await build({ stdin: { contents: `
      import { createElement } from 'react';
      import { DesktopPreferencesProvider, useDesktopPreferences } from './src/features/settings/preferences';
      function Probe() { const { info, setStartup } = useDesktopPreferences(); return createElement('div',null,createElement('output',null,JSON.stringify([info?.launchAtLogin,info?.launchAtLoginRequiresApproval])),createElement('button',{onClick:()=>setStartup(true)},'enable'),createElement('button',{onClick:()=>setStartup(false)},'disable')); }
      export function Fixture() { return createElement(DesktopPreferencesProvider,null,createElement(Probe)); }
    `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: ['react', '@tauri-apps/api/*'] });
    const module = { exports: {} };
    new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
    const prefs = { language: 'en', theme: 'light', shortcut: '', floatingWindow: true };
    let enabled = false, approval = false, delayed;
    let delayRead = false;
    mockWindows('main');
    mockIPC(command => {
      if (command === 'get_desktop_settings') {
        const value = { preferences: prefs, launchAtLogin: enabled, launchAtLoginRequiresApproval: approval, version: '0.2.5', githubUrl: null };
        return delayRead ? new Promise(resolve => { delayed = () => resolve(value); }) : value;
      }
      if (command === 'set_launch_at_login') return { enabled, requiresApproval: approval };
    }, { shouldMockEvents: true });
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(createElement(module.exports.Fixture)));
    const state = () => JSON.parse(document.querySelector('output').textContent);
    assert.deepEqual(state(), [false, false]);
    approval = true;
    await act(async () => document.querySelectorAll('button')[0].click());
    assert.deepEqual(state(), [false, true], 'pending consent must not be represented as enabled');
    approval = false; enabled = true;
    await act(async () => window.dispatchEvent(new dom.window.Event('focus')));
    assert.deepEqual(state(), [true, false], 'returning from System Settings reads actual approval');
    delayRead = true;
    await act(async () => window.dispatchEvent(new dom.window.Event('focus')));
    enabled = false;
    await act(async () => document.querySelectorAll('button')[1].click());
    assert.deepEqual(state(), [false, false]);
    await act(async () => delayed());
    assert.deepEqual(state(), [false, false], 'stale focus response must not re-enable the UI');
  } finally {
    if (root) await act(async () => root.unmount());
    clearMocks(); dom.window.close();
    for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
});
