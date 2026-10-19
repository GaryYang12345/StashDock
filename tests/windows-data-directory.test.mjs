import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreWindowsDataDirectory } from '../plugins/stashdock/scripts/windows-data-directory.mjs';

test('stale Windows hosts recover the user override without shell evaluation', () => {
  const env = {};
  restoreWindowsDataDirectory(env, 'win32', (command, args, options) => {
    assert.equal(command, 'reg.exe');
    assert.deepEqual(args, ['query', 'HKCU\\Environment', '/v', 'STASHDOCK_DATA_DIR']);
    assert.equal(options.windowsHide, true);
    assert.equal(options.timeout, 1500);
    return '\r\n    STASHDOCK_DATA_DIR    REG_SZ    D:\\My Library\r\n';
  });
  assert.equal(env.STASHDOCK_DATA_DIR, 'D:\\My Library');
});

test('explicit paths win and absent overrides retain normal platform defaults', () => {
  const explicit = { STASHDOCK_DATA_DIR: 'D:/explicit' };
  const unexpected = () => { throw new Error('must not query'); };
  restoreWindowsDataDirectory(explicit, 'win32', unexpected);
  assert.equal(explicit.STASHDOCK_DATA_DIR, 'D:/explicit');
  const nonWindows = {}; restoreWindowsDataDirectory(nonWindows, 'darwin', unexpected);
  assert.deepEqual(nonWindows, {});
  const missing = {}; restoreWindowsDataDirectory(missing, 'win32', unexpected);
  assert.deepEqual(missing, {});
  const unresolved = {};
  restoreWindowsDataDirectory(unresolved, 'win32', () => 'STASHDOCK_DATA_DIR REG_EXPAND_SZ %USERPROFILE%\\Library');
  assert.deepEqual(unresolved, {});
});
