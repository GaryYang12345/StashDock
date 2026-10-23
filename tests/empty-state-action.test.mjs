import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const compiled = await build({ stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {EmptyState} from './src/components/EmptyState'; export const render=(query, scope='all')=>renderToStaticMarkup(<EmptyState query={query} scope={scope} onAdd={()=>{}} onClearSearch={()=>{}} onShowAll={()=>{}}/>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.module.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', compiled.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url));
test('the empty state names its real reason: library, collection, tag or search', () => {
  const empty = module.exports.render('');
  assert.match(empty, /lucide-plus/);
  assert.match(empty, /Your library is empty/);
  assert.match(empty, /Import references/);
  // An empty collection without a search is not a failed search.
  const files = module.exports.render('', 'files');
  assert.match(files, /No files yet/);
  assert.match(files, /Import references/);
  assert.doesNotMatch(files, /No matching|Clear/);
  assert.match(module.exports.render('', 'favorites'), /No favorites yet/);
  assert.doesNotMatch(module.exports.render('', 'favorites'), /<button/);
  assert.match(module.exports.render('', 'tag'), /Show all references/);
  const searched = module.exports.render('zzz', 'files');
  assert.match(searched, /No matching references/);
  assert.match(searched, /Clear search/);
  assert.doesNotMatch(searched, /lucide-plus|broader|Clear filters/);
});
