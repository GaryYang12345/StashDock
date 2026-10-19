import { copyFileSync, cpSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = 'D:/StashDock';
const recovery = process.argv[2] || root + '/artifacts/before-browser-capture-20261012';
const installed = 'C:/Users/86137/.codex/plugins/cache/personal/stashdock/0.4.27';
if (!existsSync(recovery + '/stashdock.sqlite3') || !existsSync(recovery + '/stashdock.exe')) throw Error('The current upgrade needs its own consistent recovery snapshot.');
if (!existsSync(installed + '/.codex-plugin/plugin.json')) throw Error('The installed StashDock plugin was not found.');
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const binary = root + '/src-tauri/target/release/stashdock.exe';
copyFileSync(binary, root + '/stashdock.exe');
for (const directory of ['.codex-plugin', 'scripts', 'dist', 'web', 'server', 'bin', 'skills', 'notices', 'assets']) cpSync(root + '/plugins/stashdock/' + directory, installed + '/' + directory, { recursive: true });
copyFileSync(root + '/plugins/stashdock/.mcp.json', installed + '/.mcp.json');
for (const [built, deployed] of [[binary, root + '/stashdock.exe'], [root + '/plugins/stashdock/bin/win32-x64/stashdock-preview.exe', installed + '/bin/win32-x64/stashdock-preview.exe'], [root + '/plugins/stashdock/web/shelf.html', installed + '/web/shelf.html'], [root + '/plugins/stashdock/dist/mcp-server.mjs', installed + '/dist/mcp-server.mjs']]) {
  if (digest(built) !== digest(deployed)) throw Error('The deployed code does not match the build.');
}
console.log('Desktop and Codex plugin code verified. User library and retired session data were not replaced.');
