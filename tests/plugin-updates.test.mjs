import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPluginUpdates } from '../plugins/stashdock/server/plugin-updates.mjs';

const repository = 'owner/stashdock';
const release = (tag, assets, extra = {}) => ({ tag_name: tag, html_url: `https://github.com/${repository}/releases/tag/${tag}`, assets: assets.map(name => ({ name })), ...extra });
const answer = releases => async (url, init) => {
  assert.equal(url, `https://api.github.com/repos/${repository}/releases?per_page=30`);
  assert.equal(init.redirect, 'error');
  return new Response(JSON.stringify(releases), { status: 200 });
};

test('plugin update check finds the newest plugin package among releases', async () => {
  const releases = [
    release('desktop-v0.9.0', ['StashDock_0.9.0_x64-setup.exe']),
    release('plugin-v0.5.1', ['stashdock-plugin-0.5.1-win32-x64.zip'], { prerelease: true }),
    release('plugin-v0.5.0', ['stashdock-plugin-0.5.0-win32-x64.zip']),
    release('plugin-v0.4.30', ['stashdock-plugin-0.4.30-win32-x64.zip']),
    release('plugin-v0.6.0', ['stashdock-plugin-0.6.0-win32-x64.zip'], { draft: true }),
  ];
  assert.deepEqual(await checkPluginUpdates({ repository, current: '0.4.28', fetchImpl: answer(releases) }),
    { status: 'available', version: '0.5.0', url: `https://github.com/${repository}/releases/tag/plugin-v0.5.0` });
  assert.equal((await checkPluginUpdates({ repository, current: '0.5.0', fetchImpl: answer(releases) })).status, 'current');
  assert.equal((await checkPluginUpdates({ repository, current: '0.10.0', fetchImpl: answer(releases) })).status, 'current');
});

test('plugin update check ignores foreign pages and reports no release honestly', async () => {
  const foreign = [{ html_url: 'https://evil.example/releases/x', assets: [{ name: 'stashdock-plugin-9.0.0-win32-x64.zip' }] }];
  assert.equal((await checkPluginUpdates({ repository, current: '0.4.28', fetchImpl: answer(foreign) })).status, 'unconfigured');
  assert.equal((await checkPluginUpdates({ repository, current: '0.4.28', fetchImpl: answer([]) })).status, 'unconfigured');
  assert.deepEqual(await checkPluginUpdates({ repository: '', current: '0.4.28', fetchImpl: () => assert.fail('no request') }), { status: 'unconfigured', version: null, url: null });
});

test('plugin update check failures use the shared desktop copy', async () => {
  await assert.rejects(checkPluginUpdates({ repository, current: '0.4.28', fetchImpl: async () => { throw TypeError('fetch failed'); } }), /Check your connection and try again/);
  await assert.rejects(checkPluginUpdates({ repository, current: '0.4.28', fetchImpl: async () => new Response('', { status: 403 }) }), /Try again later/);
  await assert.rejects(checkPluginUpdates({ repository, current: '0.4.28', fetchImpl: async () => new Response('{', { status: 200 }) }), /could not be read/);
});
