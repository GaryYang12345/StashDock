import test from 'node:test';
import assert from 'node:assert/strict';
import { registerBrowserHost } from '../plugins/stashdock/scripts/register-browser-host.mjs';

test('isolated MCP fixtures and unsupported platforms never register a system browser host', () => {
  let calls = 0;
  const run = () => { calls++; };
  registerBrowserHost({ STASHDOCK_NATIVE_HOST_REGISTRATION: 'off' }, 'win32', run);
  registerBrowserHost({ STASHDOCK_NATIVE_HOST_REGISTRATION: 'off' }, 'darwin', run);
  registerBrowserHost({}, 'linux', run);
  assert.equal(calls, 0);
});

test('normal Windows startup registers only the plugin-owned packaged helper', () => {
  const calls = [];
  registerBrowserHost({}, 'win32', (...args) => { calls.push(args); });
  assert.equal(calls.length, 1);
  const [helper, args, options] = calls[0];
  assert.match(helper.replaceAll('\\', '/'), /\/plugins\/stashdock\/bin\/win32-x64\/stashdock-browser\.exe$/);
  assert.deepEqual(args, ['--register', 'plugin']);
  assert.equal(options.windowsHide, true);
  assert.equal(options.timeout, 5000);
  assert.deepEqual(options.stdio, ['ignore', 'ignore', 'pipe']);
});

for (const platform of ['win32','darwin']) test(`${platform} registration uses this plugin installation only`, () => {
  const calls=[];registerBrowserHost({},platform,(...args)=>calls.push(args));
  assert.equal(calls.length,1);
  assert.ok(calls[0][0].replaceAll('\\', '/').endsWith(platform==='darwin'?`/bin/darwin-${process.arch}/stashdock-browser`:'/bin/win32-x64/stashdock-browser.exe'));
  assert.deepEqual(calls[0][1],['--register','plugin']);
});
