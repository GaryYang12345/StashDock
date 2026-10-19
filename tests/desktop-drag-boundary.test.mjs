import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { mockIPC, mockWindows, clearMocks } from '@tauri-apps/api/mocks';

test('grey drag surfaces retain native dragging and exclude interactive controls', async () => {
  const dom = new JSDOM('<div id="grey"><button><span id="control">Control</span></button></div>');
  const names = ['window', 'isTauri'];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true });
  Object.defineProperty(globalThis, 'isTauri', { value: true, configurable: true });
  try {
    const built = await build({ entryPoints: ['src/lib/desktopWindows.ts'], bundle: true, write: false, format: 'cjs', platform: 'node', external: ['@tauri-apps/api/*'] });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', built.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
    const calls = [];
    mockIPC(command => { calls.push(command); }); mockWindows('main');
    let prevented = 0;
    const event = { target: dom.window.document.getElementById('grey'), button: 0, detail: 1, preventDefault: () => { prevented++; } };
    module.exports.handleTitlebarDrag(event, true);
    await Promise.resolve();
    assert.deepEqual(calls, ['plugin:window|start_dragging']);
    assert.equal(prevented, 1);
    for (const blocked of [{ ...event, target: dom.window.document.getElementById('control') }, { ...event, button: 2 }, { ...event, detail: 2 }]) module.exports.handleTitlebarDrag(blocked, true);
    module.exports.handleTitlebarDrag(event, false);
    await Promise.resolve();
    assert.equal(calls.length, 1);
  } finally {
    clearMocks(); dom.window.close();
    for (const [name, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
});
