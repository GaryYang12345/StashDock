import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(resolve(root, path), 'utf8');

test('remaining business UI uses Arc tokens and scale, without legacy overrides', async () => {
  for (const path of ['src/components/ContextBar.tsx','src/components/DesktopImportDialog.tsx','src/components/EmptyState.tsx','src/components/FluidDialog.tsx','src/features/library/LibraryView.tsx']) {
    const source = await read(path);
    assert.doesNotMatch(source, /text-zinc|bg-zinc|border-zinc|font-semibold|text-\[\d+px\]|—/);
  }
  for (const path of ['src/components/ContextBar.module.css','src/components/DesktopImportDialog.module.css','src/components/FluidDialog.module.css','extension/sidepanel.css']) {
    assert.doesNotMatch(await read(path), /#[\da-f]{3,8}\b|(?:rgb|hsl)\(|font-weight:\s*(?:600|700|800|bold)|text-transform:\s*uppercase|outline:|100vw/);
  }
  assert.doesNotMatch(await read('src/index.css'), /\.fluid-ui button|\.field\s*\{|image-reveal/);
});

test('extension assets have a single canonical source and cannot silently drift', () => {
  const result = execFileSync(process.execPath, ['scripts/sync-extension-ui.mjs','--check'], {cwd:root,encoding:'utf8'});
  assert.match(result,/match their canonical sources/);
});

test('monochrome brand theme adaptation has one owner across React surfaces', async () => {
  assert.match(await read('src/components/BrandIcon.tsx'), /styles.mark/);
  assert.match(await read('src/components/BrandIcon.module.css'), /data-theme="dark".*filter: invert\(1\)/);
  for (const path of ['src/components/Sidebar.module.css','src/features/design/DesignLab.module.css']) {
    assert.doesNotMatch(await read(path), /filter: invert/);
  }
});

test('browser preview and application use the canonical structured context', async () => {
  const browser = await import('../src/lib/context-format.mjs');
  const apiUrl = 'data:text/javascript;base64,' + Buffer.from('export const isTauri=()=>false; export const invoke=()=>{throw Error("Browser must not call native clipboard");};').toString('base64');
  const source = ts.transpileModule(await read('src/lib/context.ts'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replaceAll("'./context-format.mjs'", JSON.stringify(new URL('../src/lib/context-format.mjs', import.meta.url).href)).replace("'@tauri-apps/api/core'", JSON.stringify(apiUrl));
  const app = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const fixtures = [
    {id:'web',title:'Saved page',kind:'web',source:'example.com',url:'https://example.com',excerpt:'Context',tags:['Research'],origin:{platform:'Chrome',folderPath:['Saved','Research']}},
    {id:'note',title:'A note',kind:'note',source:'StashDock',content:'Captured content',tags:[]},
  ];
  assert.equal(browser.buildContext(fixtures),app.buildContext(fixtures));
  assert.equal((browser.buildContext(fixtures).match(/^## /gm)||[]).length,2);
});

test('panel adapter delegates semantics to Radix and guards the opening press', async () => {
  const source = await read('src/components/FluidDialog.tsx');
  assert.match(source,/container=\{host\}/);
  assert.match(source,/\.desktop-panel/);
  assert.match(source,/DialogPrimitive.Title/);
  assert.match(source,/onCloseAutoFocus/);
  assert.match(source,/originalEvent.timeStamp < mountedAt.current/);
  assert.doesNotMatch(source,/querySelectorAll|event.key === "Tab"/);
});

test('browser sidebar reuses Arc fields and has no shelf or bookmark import', async () => {
  const html=await read('extension/sidepanel.html'), js=await read('extension/sidepanel.js');
  const popup=await read('src/features/browser-extension/Popup.tsx');
  assert.match(html,/ui\/foundation.css/);assert.match(html,/sidepanel.js/);
  assert.match(js,/renderPopup/);assert.match(await read('extension/background.js'),/captureActivePage/);
  assert.match(popup,/ReferenceTagsField/);assert.match(popup,/<Input label="Title"/);assert.match(popup,/<Textarea label="Content"/);
  assert.doesNotMatch(popup,/ReferenceCardView|ReferenceEditor|Copy for AI/);
});

test('retired browser shelf is absent; the MCP App reuses Arc and approved dashboard cards', async () => {
  const source = await read('src/App.tsx');
  assert.doesNotMatch(source,/DockView|\/dock/);
  const mcp = await read('plugins/stashdock/server/create-server.mjs');
  assert.doesNotMatch(mcp,/get_stashdock_dock_url|STASHDOCK_API_URL/);
  assert.doesNotMatch(mcp,/sidepanel.css|createRoot|DELETE/);
  const shelf = await read('src/features/mcp-app/McpShelf.tsx');
  assert.match(shelf,/components\/StashCard.module.css/);
  assert.match(shelf,/components\/DockHeader.module.css/);
  assert.match(shelf,/components\/arc\/button\/button/);
  assert.match(shelf,/components\/arc\/scroll-area\/scroll-area/);
  assert.doesNotMatch(shelf,/deleteItem|toggleFavorite|nativeDrag|navigator.clipboard/);
});
