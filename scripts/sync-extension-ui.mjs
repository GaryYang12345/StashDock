// Plain-HTML adapter assets. One source of tokens, local fonts and Lucide glyphs.
// --check is read-only and catches drift without silently rewriting a release.
import { readFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { build } from 'esbuild';
import { writeIfChanged } from './lib/write-if-changed.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
async function emit(path, content) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (check) {
    if (!(await readFile(path)).equals(bytes)) throw Error(`Extension asset drift: ${path}`);
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeIfChanged(path, bytes);
  }
}
const productLinks = JSON.parse(await readFile(resolve(root,'src-tauri/product-links.json'),'utf8'));
await emit(resolve(root,'extension/ui/native-host.js'),`// Generated from product-links.json.\nexport const firefoxNativeHost = ${JSON.stringify(productLinks.browserExtensions.firefox.nativeHost)};\n`);
const shelf = await build({ entryPoints: [resolve(root, 'src/features/browser-extension/Popup.tsx')], bundle: true, write: false,
  format: 'esm', target: 'es2022', minify: true, metafile: true, outdir: resolve(root, 'extension/ui'), entryNames: 'popup',
  loader: { '.svg': 'dataurl', '.png': 'dataurl', '.woff2': 'dataurl' }, jsx: 'automatic' });
for (const output of shelf.outputFiles) await emit(output.path, output.contents);
const packages = new Set();
for (const input of Object.keys(shelf.metafile.inputs)) {
  const parts = input.replaceAll('\\', '/').split('node_modules/').at(-1).split('/');
  if (input.includes('node_modules')) packages.add(parts.slice(0, parts[0].startsWith('@') ? 2 : 1).join('/'));
}
for (const name of [...packages].sort()) {
  const folder = resolve(root, 'node_modules', name);
  const files = (await readdir(folder)).filter(file => /^(?:licen[cs]e|copying|notice|ofl)(?:[.-]|$)/i.test(file));
  if (!files.length && name === 'react-remove-scroll-bar') files.push('SPECIAL');
  if (!files.length) throw Error(`Missing extension dependency license: ${name}`);
  for (const file of files) {
    const from = file === 'SPECIAL' ? resolve(root, 'public/licenses/react-remove-scroll-bar-MIT.txt') : resolve(folder, file);
    const to = resolve(root, 'extension/ui/notices', `${name.replaceAll('/', '_')}--${file}`);
    await emit(to, await readFile(from));
  }
}
const copies = [
  ['assets/brand/full.png', 'extension/ui/brand-full.png'],
  ['src/components/arc/foundation.css', 'extension/ui/foundation.css'],
  ['src/styles/tooltips.css', 'extension/ui/tooltips.css'],
  ['src/components/arc/LICENSE', 'extension/ui/ARC-LICENSE'],
  ['node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'extension/ui/inter-latin.woff2'],
  ['node_modules/@fontsource-variable/inter/LICENSE', 'extension/ui/INTER-LICENSE'],
  ['node_modules/lucide-react/LICENSE', 'extension/ui/LUCIDE-LICENSE'],
  ['node_modules/@mozilla/readability/LICENSE.md', 'extension/ui/READABILITY-LICENSE'],
  ['public/licenses/Readability-NOTICE.txt', 'extension/ui/READABILITY-NOTICE'],
  ['public/licenses/LobeIcons-LICENSE', 'extension/ui/notices/LobeIcons-LICENSE'],
  ['src/lib/reference-url.mjs', 'extension/ui/reference-url.js'],
];
for (const [source, target] of copies) {
  const from = resolve(root, source), to = resolve(root, target);
  await emit(to, await readFile(from));
}
const capture = (await build({ entryPoints: [resolve(root, 'extension/page-capture.js')], bundle: true, write: false,
  format: 'iife', globalName: 'StashDockPageCapture', target: 'es2022', minify: true,
  })).outputFiles[0].text;
const capturePath = resolve(root, 'extension/ui/page-capture.js');
await emit(capturePath, capture);
const siteIdentity = ts.transpileModule(await readFile(resolve(root, 'src/lib/siteIdentity.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const identityPath = resolve(root, 'extension/ui/siteIdentity.js');
await emit(identityPath, siteIdentity);
for (const [source, target] of [['src/lib/tooltips.ts', 'extension/ui/tooltips.js'], ['src/components/arc/motion-tokens.ts', 'extension/ui/motion-tokens.js']]) {
  const compiled = ts.transpileModule(await readFile(resolve(root, source), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  await emit(resolve(root, target), compiled);
}
const scrollbars = await readFile(resolve(root, 'src/styles/scrollbars.css'));
const scrollbarPath = resolve(root, 'extension/ui/scrollbars.css');
await emit(scrollbarPath, scrollbars);
console.log(check ? 'Extension Arc assets match their canonical sources.' : 'Synced extension Arc tokens, local Inter and official Lucide icons.');
