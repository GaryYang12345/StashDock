// Package the final assembled App, after native helper embedding and signing.
// Tauri's earlier bundle step must not seal a DMG with missing native helpers.
import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rename, rm, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

if (process.platform !== 'darwin') throw Error('Create the Mac disk image on macOS.');
const root = resolve(import.meta.dirname, '..');
const app = resolve(process.argv[2] || join(root, 'src-tauri/target/release/bundle/macos/StashDock.app'));
const destination = resolve(process.argv[3] || join(root, 'output/releases'));
const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', timeout: 120_000 });
const plist = key => run('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', join(app, 'Contents/Info.plist')]).trim();
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version) || plist('CFBundleShortVersionString') !== version || plist('CFBundleIdentifier') !== 'app.stashdock.desktop') {
  throw Error('Build the matching StashDock App before packaging.');
}
const binary = join(app, 'Contents/MacOS', plist('CFBundleExecutable'));
const architectures = run('/usr/bin/lipo', ['-archs', binary]).trim();
const label = ({ arm64: 'aarch64', x86_64: 'x64' })[architectures];
if (!label) throw Error('Package a verified single-architecture Mac build.');
run('/usr/bin/codesign', ['--verify', '--strict', '--deep', app]);
const helpers = ['stashdock-browser', 'stashdock-storage', 'stashdock-preview'].map(name => join(app, 'Contents/MacOS', name));
helpers.push(join(app, 'Contents/Helpers/StashDockRenderer.app/Contents/MacOS/stashdock-render'));
for (const helper of helpers) {
  await access(helper);
  if (run('/usr/bin/lipo', ['-archs', helper]).trim() !== architectures) throw Error('A native helper does not match the App architecture.');
}
await mkdir(destination, { recursive: true });
const scratch = await mkdtemp(join(destination, '.stashdock-dmg-'));
const dmg = join(destination, `StashDock_${version}_${label}.dmg`);
try {
  const contents = join(scratch, 'contents');
  await mkdir(contents);
  run('/usr/bin/ditto', [app, join(contents, 'StashDock.app')]);
  await symlink('/Applications', join(contents, 'Applications'));
  const image = join(scratch, 'StashDock.dmg');
  run('/usr/bin/hdiutil', ['create', '-volname', 'StashDock', '-srcfolder', contents, '-format', 'UDZO', image]);
  run('/usr/bin/hdiutil', ['verify', image]);
  // Replace only this generated release filename after the new image is valid.
  await rename(image, dmg);
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(dmg)) digest.update(bytes);
  console.log(JSON.stringify({ dmg, version, architecture: architectures, sha256: digest.digest('hex') }));
} finally { await rm(scratch, { recursive: true, force: true }); }
