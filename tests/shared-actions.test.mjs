import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('dashboard and MCP use one owner for reference menu labels and icon geometry', async () => {
  const actions = await read('src/components/referenceActions.tsx');
  assert.match(actions, /label: 'Edit content', icon: <FileText size=\{16\} strokeWidth=\{1\.75\}/);
  assert.match(actions, /<MoreHorizontal size=\{20\} strokeWidth=\{1\.75\}/);
  for (const file of ['src/components/StashCard.tsx', 'src/features/mcp-app/McpShelf.tsx']) {
    const source = file.includes('McpShelf') ? await read('src/components/StashCard.tsx') : await read(file);
    assert.match(source, /referenceEditActions/);
    assert.match(source, /<ReferenceMenuIcon \/>/);
    assert.doesNotMatch(source, /FilePenLine|label: 'Edit content'|label: 'Edit card'/);
    assert.match(source, /ExternalLink size=\{14\} strokeWidth=\{1\.75\}/);
  }
});

test('MCP tags list all tags with shared right-click actions and the dashboard editor, without pinning', async () => {
  const shelf = await read('src/features/mcp-app/McpShelf.tsx');
  const filter = await read('src/components/ShelfTagFilter.tsx');
  assert.match(shelf, /<TagEditor operation=\{tagOperation\} returnFocus=\{tagFocus\}/);
  assert.match(filter, /tags\.map\(tag/);
  assert.match(filter, /<DesktopMenu[^>]*context/);
  assert.match(filter, /label=\{t\('Actions for tag \{name\}'/);
  assert.doesNotMatch(filter, /portalContainer=\{panel\}/);
  assert.match(filter, /tagEditActions/);
  assert.match(await read('src/components/Sidebar.tsx'), /tagEditActions/);
  assert.doesNotMatch(shelf + filter, /Manage tags|Browse all tags|TagsDialog|tags\.slice/);
  assert.doesNotMatch(shelf, /onPin=|pinnedTags=|usePinnedTags/);
  assert.match(filter, /onPin \? \[/);
  assert.match(await read('src/features/mcp-app/TagFilter.tsx'), /ShelfTagFilter as TagFilter/);
  for (const name of ['rename_stashdock_tag', 'delete_stashdock_tag']) assert.ok(shelf.includes(name));
  assert.match(await read('src/features/mcp-app/main.tsx'), /<TooltipLayer \/>/);
  assert.match(await read('src/components/StashCard.tsx'), /data-tooltip=\{t\("Delete reference"\)\}/);
  assert.match(shelf, /<ReferenceCardView/);
  assert.match(shelf, /<ReferenceDeleteDialog target=\{deleting\}/);
  assert.match(await read('src/components/ReferenceDeleteDialog.tsx'), /Keep references.*Keep reference/);
});
