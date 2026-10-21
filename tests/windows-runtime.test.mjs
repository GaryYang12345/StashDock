import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const text = path => readFile(path, 'utf8');

test('Windows plugin launches its own pinned Node without a bundled browser', async () => {
  const config = JSON.parse(await text('plugins/stashdock/.mcp.json')).mcpServers.stashdock;
  assert.equal(config.command, './bin/win32-x64/node.exe');
  assert.deepEqual(config.args, ['scripts/mcp-server.mjs']);
  assert.equal(config.cwd, '.');
  assert.doesNotMatch(JSON.stringify(config), /\$\{|[A-Z]:[\\/]/i);
  for (const verifier of ['scripts/verify-plugin-release.mjs', 'scripts/verify-installed-mcp-context.mjs']) {
    const source = await text(verifier);
    assert.match(source, /args: config\.args, cwd: resolve\((?:plugin|folder), config\.cwd\)/);
    assert.doesNotMatch(source, /replaceAll\('\$\{PLUGIN_ROOT\}'/);
  }
  const pin = JSON.parse(await text('scripts/node-runtime-lock.json'));
  assert.match(pin.sha256, /^[a-f0-9]{64}$/);
  assert.equal(new URL(pin.url).hostname, 'nodejs.org');
  const build = await text('scripts/build-mcp-app.mjs');
  assert.match(build, /prepare-node-runtime/);
  assert.match(build, /Node\.js-LICENSE/);
  assert.doesNotMatch(build, /verifiedRuntime|preview-runtime/);
  const desktop = JSON.parse(await text('src-tauri/tauri.conf.json'));
  assert.ok(!JSON.stringify(desktop.bundle.resources).includes('preview-runtime'));
});

test('renderer owns WebView2 COM, private profile and bounded event/command queues', async () => {
  const source = await text('src-tauri/src/preview_webview.rs');
  for (const pattern of [/sync_channel\(32\)/, /sync_channel\(256\)/, /set_exclusive_user_data_folder_access\(true\)/, /BrowserJob::assign/, /SetAreHostObjectsAllowed\(false\)/, /SetState\(COREWEBVIEW2_PERMISSION_STATE_DENY\)/, /SetCancel\(true\)/, /fn publish/, /overflow\.store\(true/]) assert.match(source, pattern);
  assert.doesNotMatch(source, /remote-debugging-port|--no-sandbox|--ignore-certificate-errors/);
  for (const event of ['add_NavigationStarting', 'add_FrameNavigationStarting', 'add_BasicAuthenticationRequested', 'add_ClientCertificateRequested', 'add_LaunchingExternalUriScheme']) assert.ok(source.includes(event), event);
});
