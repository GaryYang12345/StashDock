import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { mockIPC, mockWindows, clearMocks } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';

test('cached dark startup never flashes light and an early second-window event cannot strand initial settings', async () => {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: 'http://settings.test/' });
  const names = ['window', 'document', 'navigator', 'localStorage', 'matchMedia', 'isTauri', 'IS_REACT_ACT_ENVIRONMENT'];
  const original = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const values = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    isTauri: true, IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const name of names) Object.defineProperty(globalThis, name, { value: values[name], configurable: true, writable: true });
  let root;
  const themes = [];
  const observer = new dom.window.MutationObserver(() => themes.push(document.documentElement.dataset.theme));
  try {
    const compiled = await build({ stdin: { contents: `
      import { createElement } from 'react';
      import { DesktopPreferencesProvider, primeDesktopAppearance, useDesktopPreferences } from './src/features/settings/preferences';
      import { useI18n } from './src/features/settings/locale';
      function Probe() { const {info,loading}=useDesktopPreferences(); const {t}=useI18n(); return createElement('output',null,t('Settings')+':'+(info&&!loading?'ready':'loading')); }
      export { primeDesktopAppearance };
      export function Fixture() { return createElement(DesktopPreferencesProvider,null,createElement(Probe)); }
    `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: ['react', 'react-dom', 'react-dom/client', '@tauri-apps/api/*'] });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
    const { Fixture, primeDesktopAppearance } = module.exports;
    const cached = { language: 'en', theme: 'dark', shortcut: 'Ctrl+Shift+Space' };
    localStorage.setItem('stashdock.desktop-appearance.v1', JSON.stringify(cached));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    primeDesktopAppearance();
    let finishRead;
    mockWindows('main');
    mockIPC((command) => command === 'get_desktop_settings' ? new Promise(resolve => { finishRead = resolve; }) : undefined, { shouldMockEvents: true });
    root = createRoot(document.getElementById('root'));
    await act(async () => { root.render(createElement(Fixture)); });
    assert.equal(typeof finishRead, 'function');
    assert.equal(document.documentElement.dataset.theme, 'dark');
    await act(async () => {
      await emit('desktop-preferences-changed', { ...cached, language: 'zh' });
      finishRead({ preferences: { ...cached, theme: 'light' }, launchAtLogin: false, version: '0.2.2', githubUrl: null });
    });
    assert.equal(document.querySelector('output').textContent, '设置:ready');
    assert.equal(document.documentElement.dataset.theme, 'dark');
    assert.ok(themes.length > 0);
    assert.ok(themes.every(theme => theme === 'dark'), themes.join(' → '));
  } finally {
    if (root) await act(async () => { root.unmount(); });
    observer.disconnect(); clearMocks(); dom.window.close();
    for (const name of names) {
      const descriptor = original.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  }
});
