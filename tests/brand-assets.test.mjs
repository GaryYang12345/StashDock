import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(resolve(root, path));

test('Windows app ICO uses white-tile rasters without changing transparent toolbar/tray marks', async () => {
  const ico = await read('src-tauri/icons/icon.ico');
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  const sizes = [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 128, 256];
  assert.equal(ico.readUInt16LE(4), sizes.length);
  for (const [index, size] of sizes.entries()) {
    const position = 6 + 16 * index;
    assert.equal(ico[position] || 256, size);
    assert.equal(ico[position + 1] || 256, size);
    const length = ico.readUInt32LE(position + 8);
    const offset = ico.readUInt32LE(position + 12);
    const png = ico.subarray(offset, offset + length);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert.deepEqual(png, await read(`assets/app-icon/windows/${size}.png`));
    if ([16, 32, 48, 128].includes(size)) assert.notDeepEqual(png, await read(`extension/icons/icon-${size}.png`));
    if (size === 32) assert.deepEqual(await read('extension/icons/icon-32.png'), await read('src-tauri/icons/32x32.png'));
    if (size === 256) assert.deepEqual(png, await read('src-tauri/icons/icon.png'));
  }
});

test('browser favicon uses the supplied SVG geometry with light/dark ink', async () => {
  const original = (await read('assets/brand/icon.svg')).toString();
  const favicon = (await read('assets/generated/favicon.svg')).toString();
  assert.deepEqual([...favicon.matchAll(/\bd="([^"]+)"/g)].map(m=>m[1]), [...original.matchAll(/\bd="([^"]+)"/g)].map(m=>m[1]));
  assert.match(favicon, /prefers-color-scheme:dark/);
  assert.match(favicon, /fill="currentColor"/);
  const html = (await read('index.html')).toString();
  assert.match(html, /href="\/assets\/generated\/favicon.svg"/);
  assert.doesNotMatch(html, /data:image\/svg/);
});

test('native, installer and extension select brand assets, never substitute letter badges', async () => {
  const config = JSON.parse(await read('src-tauri/tauri.conf.json'));
  assert.ok(config.bundle.icon.includes('icons/icon.ico'));
  const html = (await read('extension/sidepanel.html')).toString();
  assert.match(html, /<link rel="icon" href="icons\/icon-32.png"/);
  assert.deepEqual(await read('extension/ui/brand-full.png'), await read('assets/brand/full.png'));
  assert.doesNotMatch(html, /<span class="brand-mark"/);
  const script = (await read('scripts/generate-icon.ps1')).toString();
  assert.match(script, /assets\\brand\\icon.png/);
  assert.match(script, /generate-app-icons\.mjs/);
  assert.match((await read('src-tauri/build.rs')).toString(), /cargo:rerun-if-changed=icons\/icon\.ico/);
  assert.doesNotMatch(script, /DrawRectangle|DrawLine|FillPath|SolidBrush/);
  const pkg = JSON.parse(await read('package.json'));
  assert.match(pkg.scripts.prebuild, /npm run assets:brand && npm run assets:ui/);
  assert.equal(pkg.scripts['postdesktop:build'], 'node scripts/verify-windows-icons.mjs src-tauri/target/release/stashdock.exe');
});

test('Shell refresh changes only existing matching shortcuts and never clears a global cache', async () => {
  const source = (await read('scripts/refresh-windows-brand.ps1')).toString();
  assert.match(source, /OrdinalIgnoreCase.Equals\(\$shortcut.TargetPath, \$executable\)/);
  assert.match(source, /Copy-Item -LiteralPath \$path -Destination/);
  assert.match(source, /\$shortcut.IconLocation = "\$iconPath,0"/);
  assert.match(source, /stashdock-brand-\$digest.ico/);
  assert.match(source, /SHChangeNotify\(0x00002000, 0x00001005/);
  assert.doesNotMatch(source, /Remove-Item|Stop-Process|taskkill|ie4uinit|IconCache\.db|Clear-Item/);
});

test('folder and close share one motion owner, including reduced motion', async () => {
  const css = (await read('src/index.css')).toString();
  assert.match(css, /\.floating-folder-root:hover \.floating-folder-surface/);
  assert.doesNotMatch(css, /\.floating-folder-button:hover \.folder-artwork/);
  assert.match(css, /transition: transform var\(--duration-standard\) var\(--ease-standard\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.floating-folder-root:hover \.floating-folder-surface/);
});
