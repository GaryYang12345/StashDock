import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('MCP uses dashboard artwork, controls and footer with narrow/default/wide one/two/three columns', async () => {
  const shelf = await read('src/features/mcp-app/McpShelf.tsx');
  assert.match(shelf, /<ReferenceCardView/);
  const presentation = await read('src/components/StashCard.tsx');
  for (const part of ['styles.card', 'styles.artwork', 'styles.details', 'styles.footer', 'styles.site', 'styles.iconButton', 'PreviewArtwork']) assert.ok(presentation.includes(part), part);
  assert.doesNotMatch(shelf, /dock\.row|ReferenceThumbnail/);
  assert.match(shelf, /appRef\.current\?\.openLink/);
  const footer = shelf.slice(shelf.indexOf('<div className={`${context.bar}'));
  assert.ok(footer.indexOf('Clear selection') < footer.indexOf('onClick={() => void add(selected)}'));
  const css = await read('src/features/mcp-app/McpShelf.module.css');
  assert.match(css, /\.list \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /@container shelf \(min-width: 380px\).*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@container shelf \(min-width: 720px\).*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.ok(css.indexOf('min-width: 720px') > css.indexOf('min-width: 380px'));
  assert.doesNotMatch(css, /@media[^{}]*\{[^}]*grid-template-columns|@container shelf \(max-width: 599px\)/);
  assert.doesNotMatch(css, /batchAction|\.footer\.footer \{ padding:/);
  assert.match(await read('src/components/ContextBar.module.css'), /\.compact \.bar \{ gap: var\(--space-2\); padding: var\(--space-3\)/);
});

test('all surfaces inherit the same quiet search roles, not Arc foreground fallback', async () => {
  assert.match(await read('src/index.css'), /@import "\.\/styles\/product-tokens.css"/);
  assert.match(await read('src/features/mcp-app/main.tsx'), /import '\.\.\/\.\.\/styles\/product-tokens.css'/);
  assert.match(await read('src/styles/product-tokens.css'), /--search-border-active: var\(--border-strong\)/);
});

test('hover actions do not stick on pointer focus or successful copy; previews zoom without a new border', async () => {
  const card = await read('src/components/StashCard.module.css');
  assert.match(card, /\.card:hover \.copyAction, \.row:hover \.copyAction/);
  assert.match(card, /\.copyAction:focus-visible/);
  assert.doesNotMatch(card, /:focus-within|copyAction\[data-visible\]/);
});

test('native tray product actions follow the interface language and retain hide-versus-quit semantics', async () => {
  const source = await read('src-tauri/src/lifecycle.rs');
  assert.match(source, /"open", "Open StashDock"/);
  assert.match(source, /"exit", "Quit StashDock"/);
  assert.match(source, /"exit" => app.exit\(0\)/);
  assert.match(source, /if chinese \{\s*"打开 StashDock"\s*\} else \{\s*"Open StashDock"\s*\}/);
  assert.match(source, /if chinese \{\s*"退出 StashDock"\s*\} else \{\s*"Quit StashDock"\s*\}/);
});
