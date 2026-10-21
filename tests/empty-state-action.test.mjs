import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const compiled = await build({ stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {EmptyState} from './src/components/EmptyState'; export const render=(hasQuery)=>renderToStaticMarkup(<EmptyState hasQuery={hasQuery} onAdd={()=>{}} onClear={()=>{}}/>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.module.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', compiled.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url));
test('shared empty-library import action has the standard Plus icon; clear filters does not', () => {
  const empty = module.exports.render(false), filtered = module.exports.render(true);
  assert.match(empty, /lucide-plus/);
  assert.match(empty, /Import references/);
  assert.doesNotMatch(filtered, /lucide-plus/);
  assert.match(filtered, /Clear filters/);
});
