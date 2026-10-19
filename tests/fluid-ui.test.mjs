import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild');
const result = await build({
  stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { WindowControls } from './src/components/WindowControls'; import { BrandIcon } from './src/components/BrandIcon'; export const small = renderToStaticMarkup(React.createElement(WindowControls)); export const brand = renderToStaticMarkup(React.createElement(BrandIcon));`, resolveDir: root, loader: 'tsx' },
  bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.svg': 'dataurl', '.png': 'dataurl' },
  plugins: [{name:'semantic-css-module',setup(build){build.onLoad({filter:/\.css$/},()=>({contents:'export default {controls:"controls",control:"control"}',loader:'js'}));}}],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
const { small, brand } = module.exports;

test('window controls omit the retired Dock resize action', () => {
  const labels = value => [...value.matchAll(/aria-label="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(labels(small), ['Minimize to folder', 'Hide StashDock']);
  assert.equal((small.match(/class="control"/g) ?? []).length, 2);
});

test('window controls have a larger stable target and share neutral feedback', async () => {
  const source = await readFile(resolve(root,'src/components/WindowControls.tsx'),'utf8');
  const css = await readFile(resolve(root,'src/components/WindowControls.module.css'),'utf8');
  assert.doesNotMatch(source+css,/red-|danger|scale\(/);
  assert.match(source,/onPointerDown=\{event => event.stopPropagation\(\)\}/);
  assert.equal((source.match(/disabled=\{disabled\}/g)??[]).length,3);
  assert.match(css,/width: var\(--control-height-sm\)/);
  assert.match(css,/\.control > svg \{ pointer-events: none/);
});


test('native panel and transient paper have explicit isolated rounded clipping',async()=>{
  const css=await readFile(resolve(root,'src/index.css'),'utf8');
  assert.match(css,/desktop-native/);
  assert.doesNotMatch(css,/floating-layer|floating-paper|clip-path: inset/);
  const native=await readFile(resolve(root,'src-tauri/tauri.conf.json'),'utf8');
  assert.equal(JSON.parse(native).app.windows[0].shadow,true);
});

test('brand uses the provided full PNG lockup with no substitute badge', () => {
  assert.match(brand, /data:image\/png/);
  assert.match(brand, /alt="StashDock"/);
  assert.doesNotMatch(brand, /<span|<div|bg-zinc|rounded/);
});

test('expanded headers have no reserved space or substitute folder control', async () => {
  for (const file of ['Sidebar.tsx']) {
    const source = await readFile(resolve(root, 'src/components', file), 'utf8');
    assert.match(source, /<BrandIcon/);
    assert.doesNotMatch(source, /floatingAnchor|FolderArtwork|FloatingFolder|<span[^>]+aria-hidden/);
  }
});

test('modal covers all window layers and exiting forms cannot accept repeated input', async () => {
  const dialog = await readFile(resolve(root, 'src/components/FluidDialog.tsx'), 'utf8');
  assert.match(dialog, /DialogPrimitive.Portal[^\n]+container=\{host\}/);
  assert.match(dialog, /useIsPresent/);
  assert.match(dialog, /inert=\{!present\}/);
  assert.match(dialog, /DialogPrimitive.Content/);
  assert.match(dialog, /onCloseAutoFocus/);
  assert.match(dialog, /origin.current.focus/);
  assert.doesNotMatch(dialog, /querySelectorAll|window.addEventListener\("keydown"/);
});

test('dashboard shortcuts stay inactive while a dialog owns keyboard focus', async () => {
  const app = await readFile(resolve(root, 'src/features/library/useLibraryController.ts'), 'utf8');
  assert.match(app, /const handleShortcut = \(event: KeyboardEvent\) => \{\s*if \(!active \|\| importDialog.current\?\.isOpen\(\) \|\| editing\) return;/);
});
