import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { privateSourcePath, containsCredential } from '../scripts/verify-public-source.mjs';
test('public release gate rejects runtime, data, credential and recovery paths', () => {
  for (const path of ['output/a.png','artifacts/backup.json','src-tauri/target/a','plugins/stashdock/bin/win32-x64/node.exe','secret.env.key','docs/.env.local','src/foo.sqlite3-wal','profile/Preferences','website/dist/index.html','website/Srotone-Regular.ttf','website/src/guide/Guide.tsx','AGENTS.md','CLAUDE.md','design.md','.agents/skills/arc/SKILL.md','docs/MAC_HANDOFF_PROMPT.zh-CN.md','docs/architecture.md','docs/RELEASE_NOTES_v0.2.8.md','docs/RELEASE_NOTES_plugin-v0.4.38.md','.github/workflows/website.yml','.github/deploy.yml','scripts/prepare-website-edgeone.mjs']) assert.equal(privateSourcePath(path),true,path);
  for (const path of ['src/App.tsx','src-tauri/Cargo.lock','.agents/plugins/marketplace.json','plugins/stashdock/server/create-server.mjs','plugins/stashdock/skills/use-stashdock/SKILL.md','docs/INSTALL_WINDOWS.md','docs/macos-plugin-install.md','docs/RELEASE_NOTES_v1.0.0.md','shared/desktop-update.mjs','safari/SafariWebExtensionHandler.swift']) assert.equal(privateSourcePath(path),false,path);
  for (const text of ['gh'+'p_'+'a'.repeat(30),'-----BEGIN '+'PRIVATE KEY-----','sk-'+'b'.repeat(32)]) assert.equal(containsCredential(text),true);
  assert.equal(containsCredential('STASHDOCK_DATA_DIR and source documentation'),false);
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
