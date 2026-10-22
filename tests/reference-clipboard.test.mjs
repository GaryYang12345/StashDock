import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const transport = { native: false, invoke: async () => {} };
globalThis.__clipboardTransport = transport;
const apiUrl = moduleUrl('export const isTauri=()=>globalThis.__clipboardTransport.native; export const invoke=(...args)=>globalThis.__clipboardTransport.invoke(...args);');
const source = ts.transpileModule(await read('src/lib/context.ts'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  .replace("'@tauri-apps/api/core'", JSON.stringify(apiUrl))
  .replaceAll("'./context-format.mjs'", JSON.stringify(new URL('../src/lib/context-format.mjs', import.meta.url).href));
const { copyContext, buildContext } = await import(moduleUrl(source));
const items = [{id:'a',title:'资料',kind:'note',source:'StashDock',content:'Full context',tags:[]}, {id:'b',title:'Second',kind:'note',source:'StashDock',content:'Second context',tags:[]}];

test('desktop Copy sends only selected IDs to native file clipboard, never long text or arbitrary paths', async () => {
  const calls = [];
  transport.native = true;
  transport.invoke = async (...args) => calls.push(args);
  await copyContext([items[0]]);
  await copyContext(items);
  assert.deepEqual(calls, [['copy_reference_file', {itemIds:['a']}], ['copy_reference_file', {itemIds:['a','b']}] ]);
});

test('native failure propagates without a silent text fallback or false success', async () => {
  transport.native = true;
  transport.invoke = async () => { throw Error('Clipboard busy'); };
  await assert.rejects(copyContext(items), /Clipboard busy/);
});

test('browser preview retains existing text copy because it cannot publish native filesystem clipboard formats', async () => {
  transport.native = false;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let value;
  Object.defineProperty(globalThis, 'navigator', { configurable:true, value:{clipboard:{writeText:async text => {value=text;}}} });
  try { await copyContext(items); assert.equal(value, buildContext(items)); }
  finally { if(previous) Object.defineProperty(globalThis,'navigator',previous); else delete globalThis.navigator; }
});

test('native copying shares drag export, main-thread Shell clipboard, durable file lifetime and no host automation', async () => {
  const clipboard = await read('src-tauri/src/reference_clipboard.rs');
  const drag = await read('src-tauri/src/reference_drag.rs');
  const windows = await read('src-tauri/src/reference_drag_windows.rs');
  assert.match(clipboard,/!matches!\(window.label\(\), "main" \| "search"\)/);
  assert.match(clipboard,/validate_selection\(&item_ids, 10_000\)/);
  assert.match(clipboard,/export_reference_file/);
  assert.match(drag,/export_reference_file\(database, &request.item_ids/);
  assert.match(clipboard,/run_on_main_thread/);
  assert.match(windows,/OleSetClipboard\(&data\)/);
  assert.match(windows,/OleFlushClipboard\(\)/);
  assert.doesNotMatch(clipboard,/remove_file|SendInput|SetForegroundWindow|clipboard.writeText|http/);
  assert.match(await read('src-tauri/src/lib.rs'),/reference_clipboard::copy_reference_file/);
});
