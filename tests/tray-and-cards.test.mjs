import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild');
const bundle = await build({
  stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {FloatingFolder} from './src/components/FloatingFolder'; import {StashCard} from './src/components/StashCard'; import {Sidebar} from './src/components/Sidebar'; const item={id:'fixture',title:'Fixture reference',source:'example.com',kind:'web',url:'https://example.com',tags:['Design'],createdAt:'2026-10-01T00:00:00Z'}; const props={item,selected:true,copied:true,dragItems:[],index:0,onToggle:()=>{},onFavorite:()=>{},onDelete:()=>{},onOpen:()=>{},onCopy:()=>{}}; export const folder=renderToStaticMarkup(<FloatingFolder onOpen={()=>{}}/>); export const grid=renderToStaticMarkup(<StashCard {...props} view="grid"/>); export const list=renderToStaticMarkup(<StashCard {...props} view="list"/>); export const sidebar=renderToStaticMarkup(<Sidebar active="all" counts={{all:1,recent:1,web:1,files:0,favorites:0}} tags={[]} activeTag={null} onSelect={()=>{}} onSelectTag={()=>{}}/>);`, resolveDir: root, loader: 'tsx' },
  bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',loader:{'.svg':'dataurl','.png':'dataurl'},
  plugins:[{name:'css-modules',setup(build){build.onLoad({filter:/\.css$/},()=>({contents:'export default {}',loader:'js'}));}}],
});
const module = {exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(require,module,module.exports);
const {folder,grid,list,sidebar}=module.exports;

test('folder close is a separate accessible button, not nested in the drag/open target',()=>{
  assert.equal((folder.match(/<button\b/g)||[]).length,2);
  assert.match(folder,/<\/button><button[^>]+aria-label="Hide StashDock"/);
  assert.doesNotMatch(folder,/data-tooltip=/);
  assert.doesNotMatch(folder,/\stitle=/);
  assert.match(folder,/class="floating-folder-surface"><button/);
});

test('native close hides; only the tray exit action can terminate the process',async()=>{
  const source=await readFile(resolve(root,'src-tauri/src/lib.rs'),'utf8');
  const lifecycle=await readFile(resolve(root,'src-tauri/src/lifecycle.rs'),'utf8');
  const bridge=await readFile(resolve(root,'src/lib/desktopWindows.ts'),'utf8');
  assert.match(source,/api.prevent_close\(\)/);
  assert.match(source,/desktop_windows::hide_stashdock/);
  assert.doesNotMatch(source+bridge,/quit_stashdock|quitStashDock/);
  assert.match(bridge,/invoke<DesktopWindowStatus>\("hide_stashdock"\)/);
  assert.match(lifecycle,/"exit" => app.exit\(0\)/);
  assert.match(lifecycle,/icons\/32x32.png/);
  assert.match(source,/desktop_windows::toggle\(app\)/);
  assert.match(source,/tauri_plugin_single_instance::init/);
  assert.match(lifecycle,/desktop_windows::show_last\(app\)/);
  assert.match(source,/desktop_windows::hide\(window.app_handle\(\)\)/);
  assert.doesNotMatch(source+lifecycle,/window.minimize\(\)/);
  assert.match(lifecycle,/window.set_icon\(Image::from_bytes/);
  const config=JSON.parse(await readFile(resolve(root,'src-tauri/tauri.conf.json'),'utf8'));
  assert.equal(config.app.windows[0].skipTaskbar,false);
});

test('grid and list expose all actions by keyboard and announce copied state',()=>{
  for(const html of [grid,list]) {
    for(const name of ['Select Fixture reference','Add Fixture reference to favorites','Open Fixture reference','Delete Fixture reference','Copy Fixture reference for AI']) assert.ok(html.includes(`aria-label="${name}"`));
    assert.match(html,/aria-pressed="true"/);
    assert.match(html,/role="status">Fixture reference copied/);
    assert.match(html,/draggable="true"/);
  }
});

test('sidebar reports the active filter and has no inert settings action',()=>{
  assert.match(sidebar,/aria-label="Collections"/);
  assert.equal((sidebar.match(/aria-pressed="true"/g)||[]).length,1);
  assert.doesNotMatch(sidebar,/Settings|Saved context/);
});

test('folder keyboard focus is inset and subtle rather than an outer black ring',async()=>{
  const css=await readFile(resolve(root,'src/components/FloatingFolder.module.css'),'utf8');
  assert.match(css,/--focus-outline: var\(--folder-control-edge\)/);
  assert.doesNotMatch(css,/var\(--(?:surface|text|border)(?:-|\))/);
  assert.match(css,/--focus-outline-width: 1px/);
  assert.match(css,/--focus-outline-offset: -7px/);
  assert.doesNotMatch(css,/\n\s*outline:/);
  const focusRule=css.match(/\.close:focus-visible[^}]+\}/)?.[0];
  assert.ok(focusRule);
  assert.doesNotMatch(focusRule,/box-shadow/);
  const dom = new JSDOM(folder);
  const close = dom.window.document.querySelector('button[aria-label="Hide StashDock"] svg');
  assert.equal(Number(close.getAttribute('width')), 32, 'Keep the full pointer target');
  const face = close.querySelector('circle');
  assert.equal(Number(face.getAttribute('r')) * 2 + 1, 18, 'Keep the 18px optical face');
  assert.equal(face.getAttribute('stroke'), '#D7D7D7');
  assert.equal(close.querySelector('[data-close-glyph]').getAttribute('stroke'), '#9C9C9C');
  dom.window.close();
});

test('initial startup shows the completed native canvas; close state is never persisted',async()=>{
  const native=await readFile(resolve(root,'src-tauri/src/desktop_windows.rs'),'utf8');
  const start=native.slice(native.indexOf('pub fn initialize'),native.indexOf('pub fn remember'));
  assert.ok(start.indexOf('main.show()')>start.indexOf('configure(&main'));
  const lifecycle=await readFile(resolve(root,'src-tauri/src/lifecycle.rs'),'utf8');
  assert.doesNotMatch(lifecycle,/localStorage|save_items|database/);
});

test('reference card restores independent rounded image actions before the quiet-toolbar redesign',async()=>{
  const source=await readFile(resolve(root,'src/components/StashCard.tsx'),'utf8');
  assert.match(source,/<article .*data-arc-ui/);
  assert.match(source,/<CopyForAI className=\{styles.copyAction\} copied=\{copied\}/);
  assert.match(source,/const select = <div className=\{styles.selection\}/);
  assert.match(source,/variant="secondary"/);
  assert.match(await readFile(resolve(root,'src/components/CopyForAI.tsx'),'utf8'),/variant="primary"/);
  assert.match(source,/<SiteIdentity item=\{item\}/);
  assert.match(source,/<div className=\{styles.artwork\}>.*\{selectable && select\}\{controls\}/);
  assert.doesNotMatch(source,/dateFormat|meta=/);
  assert.doesNotMatch(source,/styles.previewTags|item.tags.slice/);
  assert.match(source,/selected && dragItems.length \? dragItems : \[item\]/);
  assert.match(source,/startReferenceDrag\(event, items\)/);
  const transfer=await readFile(resolve(root,'src/lib/reference-drag.ts'),'utf8');
  assert.match(transfer,/if \(isTauri\(\)\)/);
  assert.match(transfer,/dragReferenceFile\(items.map/);
  assert.doesNotMatch(transfer,/setData\("text\/(?:plain|markdown|uri-list|html)"/);
  assert.doesNotMatch(source,/details=|PUBLIC REPOSITORY|git clone|Math.random|toLocaleDateString/);
  const css=await readFile(resolve(root,'src/components/StashCard.module.css'),'utf8');
  assert.doesNotMatch(css,/#[\da-f]{3,8}\b|text-transform|font-weight: (600|700)/);
  assert.match(css,/aspect-ratio: 16 \/ 9/);
  assert.match(css,/\.artwork \.selection, \.artwork \.controls \{ position: absolute/);
  assert.match(css,/\.card:hover \.selection/);
  assert.doesNotMatch(css,/backdrop-filter|--tooltip-text/);
  assert.doesNotMatch(css,/border-color: var\(--accent\)/);
});
