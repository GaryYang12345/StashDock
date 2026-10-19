import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('duplicate bookmark profiles preserve a later cached icon and one selectable URL', async () => {
  const source = ts.transpileModule(await read('src/lib/linkImport.ts'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
    .replace(/import .*from '@tauri-apps\/api\/core';/, 'const invoke = () => {}; const isTauri = () => false;')
    .replace(/import .*from '.\/bookmarks';/, 'const canonicalizeUrl = value => new URL(value).href;')
    .replace(/import .*from '@tauri-apps\/plugin-opener';/, 'const openUrl = async () => {};')
    .replace(/import .*from '.\/captureSites';/, 'const captureSites = [];')
    .replace(/import .*from '.\/referenceCover';/, 'const prepareReferenceCover = async () => {};');
  const { bookmarkCandidates } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const rows = bookmarkCandidates([{title:'First', url:'https://example.org/',folderPath:[]}, {title:'Second',url:'https://example.org/',folderPath:[],faviconUrl:'data:image/png;base64,YQ=='}], {browser:'Chrome'}, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'First');
  assert.equal(rows[0].faviconUrl, 'data:image/png;base64,YQ==');
  assert.equal(rows[0].origin.faviconUrl, rows[0].faviconUrl);
});

test('production import uses the native bookmark snapshot and image normalization in both hosts', async () => {
  const server = await read('plugins/stashdock/server/create-server.mjs');
  assert.match(server, /sources: previewService.sources, bookmarks: previewService.bookmarks, icons: previewService.icons/);
  const rust = await read('src-tauri/src/link_import.rs');
  assert.match(rust, /spawn_blocking\(move \|\| browser_bookmarks_snapshot\(&source_id\)\)/);
  assert.match(await read('src-tauri/src/bin/preview-helper.rs'), /link_import::browser_bookmarks_snapshot/);
  assert.match(rust, /crate::web_images::raster\(&data, true\)/);
  assert.match(await read('src/lib/linkImport.ts'), /read_browser_bookmark_icons/);
  assert.match(await read('src/features/mcp-app/import.ts'), /read_stashdock_bookmark_icons/);
});

test('missing icons enrich only displayed rows and reject stale results without delaying import', async () => {
  const ui = await read('src/components/DesktopImportDialog.tsx');
  assert.match(ui, /candidates.slice\(0, visibleCount\)/);
  assert.match(ui, /offset \+= 12/);
  assert.match(ui, /!iconView.current.open/);
  assert.match(ui, /normalizeFavicon\(icons\[item.url\]\)/);
  assert.match(await read('plugins/stashdock/server/preview-worker.mjs'), /maxPending: 2, maxEntries: 8/);
  assert.match(await read('src/components/SiteIdentity.tsx'), /FaviconImages key=\{sources.join/);
  assert.match(ui, /remoteFallback=\{!services.icons\}/);
});

test('Add returns from green feedback to its original black button and allows intentional repeats', async () => {
  const ui = await read('src/features/mcp-app/McpShelf.tsx');
  assert.match(ui, /const remaining = \[\.\.\.new Set\(ids\)\]/);
  assert.match(ui, /if \(!remaining.length\) return/);
  assert.ok(ui.indexOf('await addAttachmentToDraft') < ui.indexOf('successful.push(...batch)'));
  assert.match(ui, /window.setTimeout\(\(\) => setAcknowledged\(\[\]\), 1800\)/);
  assert.match(ui, /window.clearTimeout\(timer\)/);
  assert.match(ui, /action.success/);
  assert.doesNotMatch(ui, /confirmedAdds|Already added in this panel|Allow adding again/);
  assert.doesNotMatch(ui, /disabled=\{[^}]*acknowledged/);
});

test('an Add flight blocks duplicate presses without disabling and revealing peer card actions', async () => {
  const ui = await read('src/features/mcp-app/McpShelf.tsx');
  const cardAction = ui.slice(ui.indexOf('action={<Button'), ui.indexOf('action={<Button') + 1300);
  assert.match(cardAction, /disabled=\{!draftSupported\}/);
  assert.match(cardAction, /aria-disabled=\{pending.length > 0 \|\| undefined\}/);
  assert.doesNotMatch(cardAction, /disabled=\{[^}]*pendingIds/);
  assert.match(cardAction, /loading=\{pendingIds.has\(item.id\)\}/);
  assert.match(ui, /if \(!app \|\| !draftSupported \|\| flight.current\) return/);
});

test('tag and card menus share one Arc highlight; Note scrolling depends on viewport clamping, not animation', async () => {
  for (const path of ['src/components/DesktopMenu.tsx', 'src/components/ShelfTagFilter.tsx']) assert.match(await read(path), /useMenuHighlight/);
  assert.match(await read('src/components/ShelfTagFilter.tsx'), /Dropdown.RadioItem/);
  // A transformed parent menu must not become the fixed-position context
  // menu's containing block: independent portals avoid double coordinates.
  assert.doesNotMatch(await read('src/components/ShelfTagFilter.tsx'), /portalContainer=\{panel\}/);
  assert.match(await read('src/components/ShelfTagFilter.tsx'), /onPointerLeave=\{keepContextFocus\}/);
  assert.match(await read('src/components/useMenuHighlight.tsx'), /event.currentTarget.contains\(event.target as Node\)/);
  assert.match(await read('src/components/useMenuHighlight.tsx'), /motionTokens.spring.smooth/);
  assert.match(await read('src/components/FluidDialog.module.css'), /data-scrollable="false".*overflow-y: hidden/);
  assert.match(await read('src/components/FluidDialog.tsx'), /next > limit/);
});
