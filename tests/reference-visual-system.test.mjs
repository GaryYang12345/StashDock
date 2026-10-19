import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('missing previews use one shared typed artwork system in desktop and MCP cards', async () => {
  const [card, identity, visual, tokens] = await Promise.all([
    read('src/components/StashCard.tsx'), read('src/components/SiteIdentity.tsx'),
    read('src/components/ReferenceVisual.tsx'), read('src/styles/product-tokens.css'),
  ]);
  assert.match(card, /<ReferenceDefaultCover item=\{item\}/);
  assert.match(identity, /item\.kind === 'note'[\s\S]*ReferenceGlyph/);
  assert.match(visual, /@iconify\/react\/offline/);
  assert.match(visual, /generated\/reference-icons/);
  assert.doesNotMatch(visual, /glyphPaths|<svg|<path|<circle|<rect/);
  for (const kind of ['web', 'repo', 'note', 'pdf', 'document', 'spreadsheet', 'presentation', 'archive', 'video', 'audio', 'code', 'data', 'markdown', 'text', 'image', 'file']) {
    assert.match(visual, new RegExp(`['\"]${kind}['\"]`));
  }
  assert.match(tokens, /--reference-blue:/);
  assert.match(tokens, /:root\[data-theme="dark"\].*--reference-ink:/);
});

test('dialogs use whitespace instead of a middle divider and Codex selection copy keeps an inset', async () => {
  const [dialog, shelf] = await Promise.all([
    read('src/components/FluidDialog.module.css'), read('src/features/mcp-app/McpShelf.module.css'),
  ]);
  const header = dialog.match(/\.header \{[^}]+\}/)?.[0] || '';
  assert.doesNotMatch(header, /border-bottom/);
  assert.match(header, /padding: var\(--space-6\) var\(--space-6\) 0/);
  assert.match(shelf, /\.footer\.footer \{[^}]*padding-inline: var\(--space-5\)/);
});
