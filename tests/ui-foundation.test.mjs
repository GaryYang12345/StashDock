import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild');
const bundle = await build({
  stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {Button} from './src/components/arc/button/button'; import {SearchField} from './src/components/arc/search-field/search-field'; import SegmentedControl from './src/components/arc/segmented-control/segmented-control'; export const button = renderToStaticMarkup(<Button loading variant="secondary">Import references</Button>); export const search = renderToStaticMarkup(<SearchField label="Search references" value="reference" onValueChange={()=>{}} />); export const segments = renderToStaticMarkup(<SegmentedControl label="Reference view" value="list" onValueChange={()=>{}} options={[{value:'grid',label:'Grid'},{value:'list',label:'List'}]} />);`, resolveDir: root, loader: 'tsx' },
  bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.css': 'empty' },
  plugins: [{ name: 'css-modules-for-semantic-test', setup(build) { build.onLoad({ filter: /\.css$/ }, () => ({ contents: 'export default {}', loader: 'js' })); } }],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, module, module.exports);

test('one Motion entry and one icon library, with fonts bundled locally', async () => {
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  assert.ok(pkg.dependencies.motion && pkg.dependencies['lucide-react']);
  assert.equal(pkg.dependencies['framer-motion'], undefined);
  assert.equal(pkg.dependencies['@phosphor-icons/react'], undefined);
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isDirectory()) await walk(resolve(path, entry.name));
      else if (/\.tsx?$/.test(entry.name)) assert.doesNotMatch(await readFile(resolve(path, entry.name), 'utf8'), /from ["'](?:framer-motion|@phosphor-icons\/react)["']/);
    }
  }
  await walk(resolve(root, 'src'));
  const main = await readFile(resolve(root, 'src/main.tsx'), 'utf8');
  assert.equal((main.match(/foundation\.css/g) ?? []).length, 1);
  assert.match(main, /@fontsource-variable\/inter/);
  assert.match(main, /@fontsource-variable\/geist/);
});

test('Arc search has a visible associated label, native search semantics and clear action', () => {
  const { search } = module.exports;
  const id = search.match(/<input[^>]*id="([^"]+)"/)[1];
  assert.ok(search.includes(`for="${id}"`));
  assert.match(search, /type="search"/);
  assert.match(search, /aria-label="Clear search"/);
});

test('Arc segmented view has one tab stop and a labelled pressed state', () => {
  const { segments } = module.exports;
  assert.match(segments, /role="group" aria-label="Reference view"/);
  assert.equal((segments.match(/tabindex="0"/g) ?? []).length, 1);
  assert.equal((segments.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.match(segments, /data-value="list" aria-pressed="true" tabindex="0"/);
});

test('Arc pending button keeps focus, reports busy and prevents repeat clicks', () => {
  const { button } = module.exports;
  assert.match(button, /aria-busy="true"/);
  assert.match(button, /aria-disabled="true"/);
  assert.doesNotMatch(button, /disabled=""/);
});

test('both headers share primitives, controller refs and drag exclusion', async () => {
  for (const file of ['Toolbar.tsx']) {
    const source = await readFile(resolve(root, 'src/components', file), 'utf8');
    assert.match(source, /<SearchField ref=\{searchRef\}/);
    assert.match(source, /<(?:SegmentedControl|ReferenceViewToggle)/);
    assert.match(source, /data-no-drag/);
    assert.doesNotMatch(source, /handleTitlebarDrag|window-titlebar/);
  }
  const css = await readFile(resolve(root, 'src/index.css'), 'utf8');
  assert.doesNotMatch(css, /\.fluid-ui button|\.fluid-ui input|\.field\s*\{/);
});

test('workbench is lazy, reads isolated fixtures and cannot mutate the collection', async () => {
  const app = await readFile(resolve(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /const DesignLab = lazy/);
  const sample = await readFile(resolve(root, 'src/features/design/DesignLab.tsx'), 'utf8');
  assert.doesNotMatch(sample, /saveItems|deleteItem|setItemFavorite|libraryStore\.(add|remove|toggleFavorite)/);
  const library = await readFile(resolve(root, 'src/features/library/useLibrary.ts'), 'utf8');
  assert.match(library, /load: loadItems/);
  assert.doesNotMatch(library, /isRemote|setInterval|dock-ui/);
});
