import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { privateSourcePath, containsCredential } from '../scripts/verify-public-source.mjs';
test('public release gate rejects runtime, data, credential and recovery paths', () => {
  for (const path of ['output/a.png','artifacts/backup.json','src-tauri/target/a','plugins/stashdock/bin/win32-x64/node.exe','secret.env.key','docs/.env.local','src/foo.sqlite3-wal','profile/Preferences']) assert.equal(privateSourcePath(path),true,path);
  for (const path of ['src/App.tsx','src-tauri/Cargo.lock','.agents/skills/arc/SKILL.md','plugins/stashdock/server/create-server.mjs']) assert.equal(privateSourcePath(path),false,path);
  for (const text of ['gh'+'p_'+'a'.repeat(30),'-----BEGIN '+'PRIVATE KEY-----','sk-'+'b'.repeat(32)]) assert.equal(containsCredential(text),true);
  assert.equal(containsCredential('STASHDOCK_DATA_DIR and source documentation'),false);
});
test('Mac handoff follows GitHub source and current system renderer, not retired Chromium', () => {
  const prompt = readFileSync('docs/MAC_HANDOFF_PROMPT.zh-CN.md','utf8');
  assert.match(prompt,/BASELINE\.json/);assert.match(prompt,/WebView2/);assert.match(prompt,/Floating window/);
  assert.doesNotMatch(prompt,/当前 Chrome Headless Shell pin|此 ZIP 没有/);
  const script = readFileSync('scripts/package-mac-handoff.ps1','utf8');
  assert.match(script,/formatVersion=2/);assert.match(script,/rev-parse HEAD/);
  assert.doesNotMatch(script,/C:\\Users\\|\$taskAllowed|Windows source baseline/);
});
test('Git preserves verbatim upstream notice bytes for fresh-checkout asset parity', () => {
  const attributes = readFileSync('.gitattributes','utf8');
  for (const path of ['extension/ui/notices/**','plugins/stashdock/notices/**','public/licenses/**']) assert.ok(attributes.split(/\r?\n/).includes(`${path} -text`),path);
});

test('each product has one version source', async () => {
  const { readFile: read } = await import('node:fs/promises');
  const pkg = JSON.parse(await read('package.json', 'utf8'));
  const cargo = (await read('src-tauri/Cargo.toml', 'utf8')).match(/^version = "([^"]+)"/m)[1];
  assert.equal(cargo, pkg.version, 'Desktop: Cargo.toml follows package.json');
  assert.equal(JSON.parse(await read('src-tauri/tauri.conf.json', 'utf8')).version, '../package.json');
  const server = await read('plugins/stashdock/server/create-server.mjs', 'utf8');
  assert.match(server, /import pluginManifest from '\.\.\/\.codex-plugin\/plugin\.json'/);
  assert.doesNotMatch(server, /version: '\d+\.\d+\.\d+'|'\d+\.\d+\.\d+'/, 'the plugin reads its version from its manifest');
  assert.doesNotMatch(await read('src-tauri/src/public_web.rs', 'utf8'), /StashDock\/\d/);
});
