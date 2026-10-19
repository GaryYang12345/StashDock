import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild');
const result = await build({ entryPoints: ['src/features/library/usePinnedTags.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' });
const module = { exports: {} };
new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports);
const { replacePinnedTag } = module.exports;

test('pinned tags retain order, merge case-insensitively and unpin on tag removal', () => {
  assert.deepEqual(replacePinnedTag(['Design', 'Research'], 'design', 'UI'), ['UI', 'Research']);
  assert.deepEqual(replacePinnedTag(['Design', 'Research'], 'DESIGN', 'research'), ['research']);
  assert.deepEqual(replacePinnedTag(['Design', 'Research'], 'design', null), ['Research']);
  assert.deepEqual(replacePinnedTag(['Design'], 'other', null), ['Design']);
});

test('desktop edits share one card action and use existing Arc inputs without redundant copy', async () => {
  const card = await readFile('src/components/StashCard.tsx', 'utf8');
  const editor = await readFile('src/components/ReferenceEditor.tsx', 'utf8');
  const sidebar = await readFile('src/components/Sidebar.tsx', 'utf8');
  assert.match(card, /referenceEditActions/);
  assert.match(await readFile('src/components/referenceActions.tsx', 'utf8'), /label: 'Edit card'/);
  assert.doesNotMatch(card, /label: 'Edit title'|label: 'Edit tags'/);
  assert.doesNotMatch(card, /<DesktopMenu context/);
  assert.match(editor, /<ReferenceTagsField/);
  assert.match(await readFile('src/components/ReferenceTagsField.tsx', 'utf8'), /aria-label=\{t\("Existing tags"\)\}/);
  assert.doesNotMatch(editor, /DesktopTagPicker/);
  assert.doesNotMatch(editor, /Saved content stays unchanged|48 characters each/);
  assert.match(sidebar, /data-pinned-tag=\{isPinnedGroup/); assert.match(sidebar, /Unpin tag/);
  assert.match(sidebar, /onPinTag && tagRows\(pinned, true\)/);
  assert.ok(sidebar.indexOf('onPinTag && tagRows(pinned, true)') < sidebar.indexOf('<ScrollArea'));
  assert.doesNotMatch(sidebar, /pinnedExpanded|sidebar-pinned|aria-label="Pinned"/);
  assert.doesNotMatch(sidebar, /Stored on this device|Clear tag/);
});
