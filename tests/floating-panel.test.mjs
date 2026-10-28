import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('brand stack is static and list marks retain their original shape', async () => {
  const source=await readFile(new URL('../src/components/PlatformGroup.tsx',import.meta.url),'utf8');
  const css=await readFile(new URL('../src/components/PlatformGroup.module.css',import.meta.url),'utf8');
  assert.match(source,/\['x', 'xiaohongshu', 'zhihu'\]/);
  assert.doesNotMatch(source,/AvatarGroup|title=/);assert.doesNotMatch(css,/:hover|transform|transition|box-shadow/);
  assert.match(css,/border: 2px solid var\(--platform-avatar-ring\)/);
  const more=css.match(/\.more\s*\{[^}]*\}/)[0];assert.doesNotMatch(more,/background|border|radius/);
  assert.doesNotMatch(await readFile(new URL('../src/components/PlatformIcon.module.css',import.meta.url),'utf8'),/border-radius/);
  const panel=await readFile(new URL('../src/components/BrowserCapturePanel.tsx',import.meta.url),'utf8');
  assert.match(panel,/offset \+= 12/);assert.match(panel,/SiteFavicon/);assert.doesNotMatch(panel,/title=\{platform.name\}/);
  // Vite's inline SVG encoder normalizes attribute quotes to single quotes.
  const markSource=await readFile(new URL('../src/components/PlatformIcon.tsx',import.meta.url),'utf8');
  const markFunction=markSource.slice(markSource.indexOf('export function platformMark'),markSource.indexOf('export function PlatformIcon')).replace('export function','function').replace('site: CaptureSiteId','site');
  for(const fill of ['fill="white"',"fill='white'",'fill="#ffffff"',"fill='#fff'"]) {
    const marks={linkedin:'data:image/svg+xml,'+encodeURIComponent(`<svg ${fill}><path/></svg>`)};
    const mark=Function('marks','brandColors',markFunction+';return platformMark("linkedin");')(marks,{linkedin:'#0a66c2'});
    assert.match(decodeURIComponent(mark),/fill="#0a66c2"/);
  }
});

test('sidebar capture survives worker restart and rejects changed tabs and stale tokens', async () => {
  const expected={tabId:41,windowId:2,url:'https://example.org/article'};
  const entry={token:'owned-token',expected,page:{url:expected.url,content:'Isolated original page',preview:'data:image/jpeg;base64,AAAA'}};
  const session={'stashdock-sidepanel:2':entry};let listener,connectListener,activeId=41,closed=false;
  const savedChrome=globalThis.chrome, savedFetch=globalThis.fetch;
  let installed; const opened=[];
  globalThis.chrome={
    action:{onClicked:{addListener(){} }},
    windows:{onRemoved:{addListener(){} }},
    sidePanel:{close:async()=>{closed=true;},setPanelBehavior:async()=>{}},
    runtime:{id:'owned',getManifest:()=>({version:'0.4.9'}),onInstalled:{addListener(next){installed=next;}},onStartup:{addListener(){}},getURL:raw=>`chrome-extension://owned/${raw.replace(/^\//,'')}`,onMessage:{addListener:next=>{listener=next;}},onConnect:{addListener:next=>{connectListener=next;}}},
    storage:{local:{},session:{get:async key=>key?{[key]:session[key]}:session,set:async value=>Object.assign(session,value),remove:async key=>{delete session[key];}}},
    tabs:{onRemoved:{addListener(){}},create:async value=>opened.push(value),query:async()=>[{id:activeId,url:expected.url,status:'complete'}]},
  };
  try {
    let source=await readFile(new URL('../extension/background.js',import.meta.url),'utf8');
    for(const path of ['library-client.js','capture-client.js','screenshot.js','panel-behavior.js','capture-sessions.js','setup-client.js','browser-host.js','safari-provider.js','firefox-provider.js','native-client.js','safari-native.js'])source=source.replace(`'./${path}'`,JSON.stringify(new URL(`../extension/${path}`,import.meta.url).href));
    await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
    globalThis.fetch=async()=>{throw Error('offline fixture');};
    installed({reason:'update'}); await new Promise(resolve=>setImmediate(resolve)); assert.equal(opened.length,0);
    installed({reason:'install'}); await new Promise(resolve=>setImmediate(resolve)); assert.equal(opened.length,0);
    globalThis.fetch=async()=>({ok:true,json:async()=>({connected:true,integrations:{items:[]}})});
    installed({reason:'install'}); await new Promise(resolve=>setImmediate(resolve)); assert.equal(opened.length,0);
    connectListener({name:'stashdock-sidebar:2:owned-client',sender:{id:'owned',url:'chrome-extension://owned/sidepanel.html'},onDisconnect:{addListener(){}},postMessage(){},disconnect(){}});
    const send=(message,sender={})=>new Promise(resolve=>{const result=listener({windowId:2,clientId:'owned-client',...message},{id:'owned',url:'chrome-extension://owned/sidepanel.html',...sender},resolve);if(!result)resolve(undefined);});
    assert.equal((await send({type:'read-current-page'})).page.content,entry.page.content);
    assert.equal(await send({type:'read-current-page'},{url:'https://example.org/evil'}),undefined);
    assert.equal(await send({type:'read-current-page'},{tab:{id:41}}),undefined);
    assert.match((await send({type:'save-current-page',token:'wrong'})).error,/expired/);
    activeId=999;
    assert.match((await send({type:'save-current-page',token:entry.token})).error,/page changed/);
    activeId=41;assert.equal((await send({type:'close-panel'})).closed,true);assert.equal(closed,true);assert.equal(session['stashdock-sidepanel:2'],undefined);
    assert.match((await send({type:'read-current-page'})).error,/closed/);
  } finally {globalThis.chrome=savedChrome;globalThis.fetch=savedFetch;}
});
