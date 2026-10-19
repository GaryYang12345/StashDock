import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
// Use Vite's existing compiler dependency; no extra test/runtime package.
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild');
const result = await build({
  stdin: {
    contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { FolderArtwork } from './src/components/FolderArtwork'; export const markup = renderToStaticMarkup(React.createElement(React.Fragment, null, React.createElement(FolderArtwork), React.createElement(FolderArtwork)));`,
    resolveDir: root,
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  loader: { '.svg': 'dataurl' },
});
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
const { markup } = module.exports;

test('artwork has independent SVG IDs and no visible brand text', () => {
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.ok(ids.length > 20);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal((markup.match(/viewBox="0 0 360 360"/g) || []).length, 2);
  assert.doesNotMatch(markup, /<text\b|StashDock|Fun Shots/);
  assert.match(markup, /data:image\/svg\+xml/);
});

test('each reference has matching exposed and frosted layers', () => {
  assert.equal((markup.match(/class="folder-reference"/g) || []).length, 12);
  assert.match(markup, /feGaussianBlur stdDeviation="8"/);
  assert.match(markup, /feComposite in="SourceAlpha" in2="soft" operator="out"/);
  assert.match(markup, /mask="url\(#folder[^)]+exposed\)"/);
});

test('desktop surface remains transparent and dimensions agree', async () => {
  const config = JSON.parse(await readFile(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'));
  const window = config.app.windows.find(window => window.label === 'folder');
  assert.equal(window.transparent, true);
  assert.equal(window.shadow, false);
  assert.equal(window.backgroundColor, '#00000000');
  assert.equal(window.width, 144);
  assert.equal(window.height, 144);
  const css = await readFile(resolve(root, 'src/index.css'), 'utf8');
  assert.equal(config.app.windows.find(window => window.label === 'main').transparent, false);
  assert.match(css, /width: 160px;\s*height: 160px;/);
  assert.match(css, /scale: \.9/);
  assert.match(css, /desktop-folder-content \{ width: 144px; height: 144px;/);
  assert.doesNotMatch(css, /floating-folder-paper|floating-folder-front|floating-folder-back|floating-folder-object/);
});
