import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';

const compiled = await build({ entryPoints: ['src/components/MarkdownPreview.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.css': 'empty', '.module.css': 'empty' }, external: ['react', 'react-dom', 'react-dom/server'] });
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const render = content => renderToStaticMarkup(createElement(module.exports.MarkdownPreview, { content }));

test('context preview renders headings, lists, code, tables and task lists', () => {
  const html = render('# Context\n\n**Important**\n\n- first\n- second\n\n```js\nconst value = 1;\n```\n\n| Name | Value |\n| --- | --- |\n| A | B |\n\n- [x] done');
  for (const pattern of [/<h1>Context<\/h1>/, /<strong>Important<\/strong>/, /<li>first<\/li>/, /<pre><code/, /<table>/, /type="checkbox" disabled="" checked=""/]) assert.match(html, pattern);
});

test('preview never executes HTML, opens executable links or fetches remote images', () => {
  const html = render('<script>alert(1)</script>\n\n<iframe src="https://evil.test"></iframe>\n\n[bad](javascript:alert%281%29)\n\n[file](file:///C:/private.txt)\n\n![cover](https://evil.test/track.png)\n\n[good](https://example.org/)');
  assert.doesNotMatch(html, /<script|<iframe|<img|href="(?:javascript|file):|src=/);
  assert.match(html, /href="https:\/\/example.org\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /cover/);
  assert.equal(render(''), '<div></div>');
});

test('both hosts share the context editor; toggling preserves the mounted editable draft', async () => {
  for (const path of ['src/features/library/LibraryView.tsx', 'src/features/mcp-app/McpShelf.tsx']) assert.match(await readFile(path, 'utf8'), /<ContentEditor/);
  const editor = await readFile('src/components/ContentEditor.tsx', 'utf8');
  assert.match(editor, /inert=\{preview\}/);
  assert.match(editor, /controlOverlay=\{preview \?/);
  assert.doesNotMatch(editor, /hidden=\{preview\}/);
  assert.match(editor, /onSave\(item.id, content\)/);
  assert.match(editor, /<MarkdownPreview content=\{content\}/);
  const toolbar = await readFile('src/components/Toolbar.tsx', 'utf8');
  assert.doesNotMatch(toolbar, /handleTitlebarDrag|window-titlebar|startDragging/);
});
