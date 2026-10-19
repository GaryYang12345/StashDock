import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('card footer is one flex row with shared responsive action labels, never stacked by card width', async () => {
  const css = await read('src/components/StashCard.module.css');
  assert.match(css, /\.footer \{ display: flex;/);
  assert.doesNotMatch(css, /\.desktop \.footer \{ display: grid/);
  assert.match(css, /@container desktop-card \(max-width: 260px\)/);
  assert.match(css, /\.site > span \{ flex: 0 1 auto;/);
  assert.doesNotMatch(css, /\.site > span \{ flex: 1;/);
  assert.doesNotMatch(css, /--text-sm:|--space-3:/);
  for (const path of ['src/components/CopyForAI.tsx', 'src/features/mcp-app/McpShelf.tsx']) assert.match(await read(path), /CardActionLabel/);
});

test('both card menus own explicit open lift and select tooltip; favorites keep progress rather than forbidden cursor', async () => {
  for (const path of ['src/components/StashCard.tsx']) {
    const source = await read(path);
    assert.match(source, /data-menu-open=/);
    assert.match(source, /onOpenChange=/);
    assert.match(source, /data-tooltip=\{t\("Select"\)\}/);
  }
  const css = await read('src/components/StashCard.module.css');
  assert.match(css, /\.card\[data-menu-open\]:not\(\[data-dragging\]\)/);
  assert.match(css.slice(css.indexOf('prefers-reduced-motion')), /card\[data-menu-open\]/);
  assert.match(await read('src/features/mcp-app/McpShelf.tsx'), /busy=\{mutationBusy\} favoriteLoading=\{favoritePending === item.id\}/);
  assert.match(await read('src/components/StashCard.tsx'), /loading=\{favoriteLoading\} disabled=\{busy && !favoriteLoading\}/);
});
