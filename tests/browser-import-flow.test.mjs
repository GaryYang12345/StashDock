import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

test('browser import requires contextual consent, survives cancellation, and only saves on explicit Import', async () => {
  const dom = new JSDOM('<div id="root"></div>', {url:'https://fixture.test/', pretendToBeVisual:true});
  const matchMedia = () => ({matches:true,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
  dom.window.matchMedia = matchMedia;
  const globals = {window:dom.window,document:dom.window.document,navigator:dom.window.navigator,
    HTMLElement:dom.window.HTMLElement,HTMLInputElement:dom.window.HTMLInputElement,HTMLButtonElement:dom.window.HTMLButtonElement,
    Element:dom.window.Element,Node:dom.window.Node,NodeFilter:dom.window.NodeFilter,
    Event:dom.window.Event,CustomEvent:dom.window.CustomEvent,MutationObserver:dom.window.MutationObserver,
    getComputedStyle:dom.window.getComputedStyle,DOMParser:dom.window.DOMParser,
    ResizeObserver:class {observe(){} unobserve(){} disconnect(){}},
    requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT:true};
  const originals=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals)) Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  let root;
  try {
    const compiled=await build({entryPoints:['src/components/DesktopImportDialog.tsx'],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',loader:{'.css':'empty','.svg':'text','.png':'dataurl','.jpg':'dataurl'},plugins:[{name:'fixture-css',setup(build){build.onLoad({filter:/\.css$/},()=>({contents:'export default {};',loader:'js'}));}}],external:['react','react-dom','react-dom/*'],logLevel:'silent'});
    const module={exports:{}}; new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
    const calls=[], saves=[]; let consents=0;
    const services={available:()=>true,sources:async()=>[],bookmarks:async()=>[],preview:async()=>({title:'',content:''}),
      readBrowser:async(browser,requestAccess)=>{calls.push([browser,requestAccess]); if(browser==='Firefox')return {status:'unavailable'}; if(consents<2 && (!requestAccess || ++consents===1))return {status:'needsAccess'}; if(requestAccess)throw new Error('Firefox is using its bookmarks. Quit Firefox, then click Refresh bookmarks.');return {status:'ready',bookmarks:[{title:'Account bookmark',url:'https://example.org/account',folderPath:['Research']}]};}};
    root=createRoot(document.getElementById('root'));
    await act(async()=>root.render(createElement(module.exports.DesktopImportDialog,{open:true,onClose:()=>{},onAdd:async items=>saves.push(items),services})));
    const button=text=>[...document.querySelectorAll('button')].find(node=>{const copy=node.cloneNode(true);copy.querySelectorAll('[aria-hidden="true"]').forEach(child=>child.remove());return copy.textContent.trim()===text;});
    assert.deepEqual(calls,[],'opening the dialog must not probe protected browser data');
    await act(async()=>button('Import from').dispatchEvent(new dom.window.MouseEvent('pointerdown',{bubbles:true,button:0,ctrlKey:false})));
    const choices=[...document.querySelectorAll('[role="menuitem"]')];
    assert.deepEqual(choices.map(node=>node.textContent),['Chrome','Edge','Firefox','Safari']);
    await act(async()=>choices[0].click());
    assert.deepEqual(calls,[['Chrome',false]]);
    assert.ok(button('Read bookmarks')); assert.ok(button('Import links').disabled); assert.equal(button('Continue'),undefined); assert.equal(button('Import from file instead'),undefined); assert.equal(button('Read local bookmarks'),undefined);
    assert.equal(button('Choose bookmark file'),undefined,'permission screen keeps one read action and a separate disabled import');
    await act(async()=>button('Read bookmarks').click());
    assert.ok(button('Read bookmarks'),'cancelling the system picker preserves a usable retry');
    assert.deepEqual(saves,[]);
    await act(async()=>button('Read bookmarks').click());
    assert.ok(document.body.textContent.includes('Quit Firefox'));
    assert.ok(!document.body.textContent.includes('No web bookmarks found'),'failed reads must not claim the browser has no bookmarks');
    assert.deepEqual(saves,[]);
    await act(async()=>button('Refresh bookmarks').click());
    assert.ok(document.body.textContent.includes('Account bookmark'));
    assert.ok(!document.body.textContent.includes('Quit Firefox'),'successful retry clears the error');
    assert.ok(button('Import 1 link'),[...document.querySelectorAll('button')].map(node=>node.textContent).join('|')); assert.equal(button('Read bookmarks'),undefined);
    assert.equal(button('Choose bookmark file'),undefined,'successful preview has no competing file import action');
    assert.deepEqual(saves,[],'reading and authorizing must not save references');
    await act(async()=>{button('Import 1 link').click();await new Promise(resolve=>setTimeout(resolve,950));});
    assert.equal(saves.length,1); assert.equal(saves[0][0].origin.platform,'Chrome');
  } finally {
    if(root)await act(async()=>root.unmount());
    // Radix defers focus restoration to the next task; keep this DOM alive until it completes.
    await act(async()=>new Promise(resolve=>setTimeout(resolve,30)));
    dom.window.close();
    for(const [key,descriptor] of originals) {if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
});
