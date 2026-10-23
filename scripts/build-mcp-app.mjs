import { build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';
import { build as esbuild } from 'esbuild';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
// Windows uses the OS WebView2 renderer. Bundle Node for independent installation.
const platform = `${process.platform}-${process.arch}`;
const nodePin = JSON.parse(await readFile(resolve(root, 'scripts/node-runtime-lock.json'), 'utf8'));
if (platform !== 'win32-x64') throw new Error('Build and verify the matching preview helper/runtime on this platform before publishing.');
const nodeBuild = spawnSync(process.execPath, [resolve(root, 'scripts/prepare-node-runtime.mjs')], { cwd: root, stdio: 'inherit', windowsHide: true });
if (nodeBuild.status !== 0) throw Error('Pinned Node runtime preparation failed.');
const helperBuild = spawnSync('powershell', ['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve(root,'scripts/with-msvc.ps1'),'preview-build'], { cwd: root, stdio: 'inherit', windowsHide: true });
if (helperBuild.status !== 0) throw new Error('Preview helper build failed.');
await mkdir(resolve(root, 'plugins/stashdock/bin', platform), { recursive: true });
await copyFile(resolve(root, 'src-tauri/target/release/stashdock-preview.exe'), resolve(root, 'plugins/stashdock/bin', platform, 'stashdock-preview.exe'));
await copyFile(resolve(root, 'src-tauri/target/release/stashdock-storage.exe'), resolve(root, 'plugins/stashdock/bin', platform, 'stashdock-storage.exe'));
await copyFile(resolve(root, 'build-runtime/node', platform, 'node.exe'), resolve(root, 'plugins/stashdock/bin', platform, 'node.exe'));
await mkdir(resolve(root, 'plugins/stashdock/assets'), { recursive: true });
await copyFile(resolve(root, 'assets/brand/icon.png'), resolve(root, 'plugins/stashdock/assets/icon.png'));
const result = await viteBuild({ configFile: false, root: resolve(root, 'src/features/mcp-app'), plugins: [react()],
  build: { write: false, assetsInlineLimit: Number.MAX_SAFE_INTEGER, cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } } },
});
const output = (Array.isArray(result) ? result[0] : result).output;
const js = output.find(asset => asset.type === 'chunk' && asset.isEntry)?.code;
const css = output.filter(asset => asset.type === 'asset' && asset.fileName.endsWith('.css')).map(asset => asset.source).join('\n');
if (!js || output.some(asset => asset.type === 'asset' && !/\.(html|css)$/.test(asset.fileName))) throw new Error('MCP App must be self-contained.');
await mkdir(resolve(root, 'plugins/stashdock/web'), { recursive: true });
await writeFile(resolve(root, 'plugins/stashdock/web/shelf.html'),
  `<!doctype html><html lang="en" data-accent="neutral"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>StashDock</title><style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body><div id="root"></div><script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`);
const serverBuild = await esbuild({ entryPoints: [resolve(root, 'plugins/stashdock/server/create-server.mjs')], bundle: true, metafile: true,
  minify: true, keepNames: true, legalComments: 'eof',
  platform: 'node', format: 'esm', target: 'node22', outfile: resolve(root, 'plugins/stashdock/dist/mcp-server.mjs'),
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
});
// A portable plugin does not ship node_modules, so include the licenses of the
// packages actually bundled in its server/UI, plus its embedded font faces.
const inputs = [...Object.keys(serverBuild.metafile.inputs), ...output.filter(asset => asset.type === 'chunk').flatMap(chunk => Object.keys(chunk.modules))];
const packages = new Set(['@fontsource-variable/inter', '@fontsource-variable/geist']);
for (const input of inputs) {
  const path = input.replaceAll('\\', '/');
  const marker = path.lastIndexOf('node_modules/');
  if (marker < 0) continue;
  const parts = path.slice(marker + 'node_modules/'.length).split('/');
  packages.add(parts.slice(0, parts[0].startsWith('@') ? 2 : 1).join('/'));
}
const notices = resolve(root, 'plugins/stashdock/notices');
// Start empty: notices describe exactly what this build bundles, never a
// dependency an earlier build had.
await rm(notices, { recursive: true, force: true });
await mkdir(notices, { recursive: true });
await copyFile(resolve(root, 'build-runtime/node', platform, 'LICENSE'), resolve(notices, 'Node.js-LICENSE'));
const inventory = [];
inventory.push(`Node.js ${nodePin.version}: MIT and bundled third-party notices (Node.js-LICENSE)`);
for (const name of [...packages].sort()) {
  const folder = resolve(root, 'node_modules', name);
  const metadata = JSON.parse(await readFile(resolve(folder, 'package.json'), 'utf8'));
  const files = (await readdir(folder)).filter(file => /^(?:licen[cs]e|copying|notice|ofl)(?:[.-]|$)/i.test(file));
  if (!files.length && name === '@cfworker/json-schema') {
    await copyFile(resolve(root, 'public/licenses/CFWorker-MIT.txt'), resolve(notices, 'CFWorker-MIT.txt'));
  } else if (!files.length && name === 'react-remove-scroll-bar') {
    // Upstream MIT LICENSE is omitted from this package's npm "files" list.
    await copyFile(resolve(root, 'public/licenses/react-remove-scroll-bar-MIT.txt'), resolve(notices, 'react-remove-scroll-bar-MIT.txt'));
  } else if (!files.length && name === 'boolbase') {
    // Upstream ISC LICENSE is omitted from the published 1.0.0 package.
    await copyFile(resolve(root, 'public/licenses/boolbase-ISC.txt'), resolve(notices, 'boolbase-ISC.txt'));
  } else if (!files.length) throw new Error(`Missing bundled dependency license: ${name}`);
  for (const file of files) await copyFile(resolve(folder, file), resolve(notices, `${name.replaceAll('/', '_')}--${file}`));
  inventory.push(`${name} ${metadata.version}: ${metadata.license || 'See license file'}`);
}
await copyFile(resolve(root, 'public/licenses/Arc-MIT.txt'), resolve(notices, 'Arc-MIT.txt'));
await copyFile(resolve(root, 'public/licenses/WebView2Com-MIT.txt'), resolve(notices, 'WebView2Com-MIT.txt'));
await copyFile(resolve(root, 'public/licenses/WindowsRs-MIT.txt'), resolve(notices, 'WindowsRs-MIT.txt'));
await copyFile(resolve(root, 'public/licenses/Brotli-MIT.txt'), resolve(notices, 'Brotli-MIT.txt'));
await copyFile(resolve(root, 'public/licenses/Brotli-BSD-3-Clause.txt'), resolve(notices, 'Brotli-BSD-3-Clause.txt'));
await copyFile(resolve(root, 'public/licenses/Flate2-MIT.txt'), resolve(notices, 'Flate2-MIT.txt'));
inventory.push('brotli 9.0.0: BSD-3-Clause AND MIT; flate2 1.1.10: MIT (native bounded response decoding)');
await copyFile(resolve(root, 'public/licenses/LobeIcons-LICENSE'), resolve(notices, 'LobeIcons-LICENSE'));
await copyFile(resolve(root, 'public/licenses/SimpleIcons-CC0.txt'), resolve(notices, 'SimpleIcons-CC0.txt'));
await copyFile(resolve(root, 'public/licenses/vscode-icons-MIT.txt'), resolve(notices, 'vscode-icons-MIT.txt'));
await copyFile(resolve(root, 'public/licenses/FlatColorIcons-LICENSE.md'), resolve(notices, 'FlatColorIcons-LICENSE.md'));
await copyFile(resolve(root, 'node_modules/pdfjs-dist/LICENSE'), resolve(notices, 'pdfjs-dist--LICENSE'));
inventory.push('pdfjs-dist 6.4.299: Apache-2.0 (embedded first-page PDF cover renderer)');
inventory.push('@iconify-icons/vscode-icons 2.0.16: MIT (generated local subset)');
inventory.push('@iconify-icons/flat-color-icons 2.0.0: MIT (generated local subset)');
await writeFile(resolve(notices, 'README.txt'), 'Bundled dependency notices. Original license files are included beside this inventory.\n\n' + inventory.join('\n'));
console.log('Built self-contained MCP App HTML and portable stdio server.');
console.log('UI bytes:', (await readFile(resolve(root, 'plugins/stashdock/web/shelf.html'))).length);
