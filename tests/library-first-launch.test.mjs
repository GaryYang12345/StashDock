import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const dataModule = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const storageSource = compile(await readFile(new URL('../src/lib/storage.ts', import.meta.url), 'utf8'));
const search = new URL('../src/lib/reference-search.mjs', import.meta.url).href;
const seed = dataModule(compile(await readFile(new URL('../src/data/seed.ts', import.meta.url), 'utf8')));

for (const [name, native, stored, expected] of [
  ['new native libraries start empty', true, null, []],
  ['invalid legacy JSON never seeds native examples', true, '{invalid', []],
  ['existing native legacy items remain migratable', true, JSON.stringify([{ id: 'user-saved' }]), [{ id: 'user-saved' }]],
  ['browser workbench retains its example content', false, null, undefined],
]) {
  test(name, async t => {
    const previous = globalThis.window;
    globalThis.window = { localStorage: { getItem: () => stored } };
    t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
    const core = dataModule(`export const calls=[]; export const isTauri=()=>${native}; export const invoke=async(command,args)=>{calls.push({command,args});return command==='list_items'?[]:undefined;}; // ${name}`);
    const dialog = dataModule('export const open=async()=>null;');
    const source = storageSource.replace('"@tauri-apps/api/core"', JSON.stringify(core))
      .replace('"@tauri-apps/plugin-dialog"', JSON.stringify(dialog))
      .replace('"../data/seed"', JSON.stringify(seed)).replace(/(['"])\.\/reference-search\.mjs\1/, JSON.stringify(search));
    const module = await import(dataModule(source));
    const result = await module.loadItems();
    if (native) {
      const { calls } = await import(core);
      assert.deepEqual(calls.find(call => call.command === 'initialize_library').args.items, expected);
    } else {
      assert.ok(result.length > 0);
    }
  });
}
