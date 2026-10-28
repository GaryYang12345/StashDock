import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { startCaptureBridge } from '../plugins/stashdock/server/capture-bridge.mjs';
import { createBrowserLibrary } from '../extension/library-client.js';
import { canonicalReferenceUrl } from '../src/lib/reference-url.mjs';
import { buildContext } from '../src/lib/context-format.mjs';
import { firefoxExtensionId } from '../src/lib/browser-extension-identity.mjs';
import productLinks from '../src-tauri/product-links.json' with { type: 'json' };
const page={id:'draft',title:'New title',kind:'web',source:'Example',url:'https://example.org/post?utm_source=a#reply',content:'New body',excerpt:'New body',tags:['New'],createdAt:'2026-10-16T00:00:00Z',preview:'data:image/jpeg;base64,AAAA',origin:{previewKind:'screenshot'}};
test('pinned Chrome and Edge save and retry through real HTTP without inspecting profile installation metadata', async t => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-pinned-save-'));
  const library = createLocalLibrary({ dataDir: root, browserEnabled: () => assert.fail('No profile access for pinned requests') });
  const bridge = startCaptureBridge(library, 0); await once(bridge, 'listening');
  t.after(async () => { await new Promise(resolve => bridge.close(resolve)); library.close(); rmSync(root, { recursive: true, force: true }); });
  const provider = `http://127.0.0.1:${bridge.address().port}`;
  for (const browser of ['chrome', 'edge']) {
    const extensionId = productLinks.browserExtensions[browser].id;
    const origin = `chrome-extension://${extensionId}`;
    const headers = { 'Content-Type': 'application/json', 'X-StashDock-Client': 'chrome-extension-v1', Origin: origin };
    const setup = await fetch(provider + '/v1/setup', { method: 'POST', headers, body: JSON.stringify({ browser, extensionId, version: '0.4.17' }) });
    assert.equal(setup.status, 200); assert.deepEqual(await setup.json(), { connected: true, owner: 'codex', integrations: { items: [] } });
    const client = createBrowserLibrary({ storage: { get: async () => ({}), set: async () => {} },
      fetcher: (url, options) => fetch(provider + new URL(url).pathname, { ...options, headers: { ...options.headers, Origin: origin } }) });
    const item = { ...page, url: `https://example.org/pinned-${browser}` }, options = { operationId: randomUUID() };
    const first = await client.save(item, options), retry = await client.save(item, options);
    assert.equal(first.saved, true); assert.deepEqual(retry, first);
  }
  assert.equal((await library.read()).length, 2);
});
test('canonical URL keys match native query encoding and remove empty legacy queries',()=>{
  assert.equal(canonicalReferenceUrl('https://example.org/post?'),'https://example.org/post');
  assert.equal(canonicalReferenceUrl('https://example.org/post?q=hello%20world'),'https://example.org/post?q=hello%20world');
});
test('an older live provider rejecting the new identity cannot hide the updated provider or receive a write', async t => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-mixed-provider-'));
  const library = createLocalLibrary({ dataDir: root, browserEnabled: () => false });
  const bridge = startCaptureBridge(library, 0); await once(bridge, 'listening');
  t.after(async () => { await new Promise(resolve => bridge.close(resolve)); library.close(); rmSync(root, { recursive: true, force: true }); });
  const { checkSetup } = await import('../extension/setup-client.js');
  const extensionId = productLinks.browserExtensions.edge.id, origin = `chrome-extension://${extensionId}`;
  const calls = [];
  const fetcher = (url, options) => {
    const target = new URL(url); calls.push([target.port, target.pathname]);
    if (target.port === '17864') return Promise.resolve(Response.json({ error: 'Old provider has not recognized this identity.' }, { status: target.pathname === '/v1/setup' ? 400 : 403 }));
    target.port = String(bridge.address().port);
    return fetch(target, { ...options, headers: { ...options.headers, Origin: origin } });
  };
  const setup = () => checkSetup({ fetcher, browser: 'edge', extensionId, version: '0.4.17' });
  const client = createBrowserLibrary({ storage: { get: async () => ({}), set: async () => {} }, fetcher, setup });
  const result = await client.save(page, { operationId: randomUUID() });
  assert.equal(result.saved, true); assert.equal((await library.read()).length, 1);
  assert.deepEqual(calls.filter(([, path]) => path === '/v1/capture'), [['17863', '/v1/capture']]);
});
function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'stashdock-mcp-test-save-confirm-'));
  const library=createLocalLibrary({dataDir:root,browserEnabled:()=>true});
  t.after(()=>{library.close();rmSync(root,{recursive:true,force:true});});
  return {root,library};
}

test('Chrome, Edge and Firefox commit readable links even with no extracted body or screenshot',async t=>{
  const {library}=fixture(t),bridge=startCaptureBridge(library,0);await once(bridge,'listening');
  t.after(async()=>{await new Promise(resolve=>bridge.close(resolve));});
  const provider=`http://127.0.0.1:${bridge.address().port}`;
  for(const browser of ['chrome','edge','firefox']) {
    const firefox=browser==='firefox';
    const origin=firefox?'moz-extension://e9aefaf5-6844-473b-a647-9455e6346978':'chrome-extension://'+(browser==='chrome'?'a':'b').repeat(32);
    const extensionId=firefox?firefoxExtensionId:origin.split('://')[1];
    const headers={'Content-Type':'application/json','X-StashDock-Client':'chrome-extension-v1',Origin:origin};
    assert.equal((await fetch(provider+'/v1/setup',{method:'POST',headers,body:JSON.stringify({browser,extensionId,version:'0.4.15'})})).status,200);
    const client=createBrowserLibrary({storage:{get:async()=>({}),set:async()=>{}},fetcher:(url,options)=>fetch(provider+new URL(url).pathname,{...options,headers:{...options.headers,Origin:origin}})});
    const item={...page,url:`https://example.org/empty-${browser}`,content:'',excerpt:'',preview:undefined,origin:{importMethod:'browser_extension',captureMethod:'page'}};
    assert.equal((await client.save(item,{operationId:randomUUID()})).saved,true);
  }
  const saved=await library.read();assert.equal(saved.length,3);
  for(const item of saved){assert.equal(item.content,undefined);assert.equal(item.preview,undefined);assert.ok(item.title);}
});
test('duplicate check is bounded; keep existing writes nothing; replace uses the new final context',async t=>{
  const {library}=fixture(t);
  const existing=library.importItems([{...page,title:'Old title',content:'Old body',tags:['Old'],preview:undefined,origin:{previewSource:'custom',author:'Old author',contentEdited:true}}]).items[0];
  library.setFavorite(existing.id,true);library.editContext(existing.id,'User AI instructions');
  const before=(await library.read())[0];
  const conflict=library.lookupCapture('https://example.org/post/').duplicate;
  assert.deepEqual(Object.keys(conflict).sort(),['id','revision','title']);
  assert.ok(JSON.stringify(conflict).length<700);
  const input={item:page,operationId:randomUUID()};
  assert.deepEqual(library.saveCapture(JSON.stringify(input)),{duplicate:conflict});
  assert.deepEqual((await library.read())[0],before);
  const body=JSON.stringify({...input,replace:conflict}),result=library.saveCapture(body);
  assert.deepEqual(result,{saved:true,id:existing.id,replaced:true});
  const after=(await library.read())[0];
  assert.equal(after.title,page.title);assert.equal(after.content,page.content);assert.deepEqual(after.tags,page.tags);assert.equal(after.preview,page.preview);
  assert.equal(after.id,before.id);assert.equal(after.favorite,false);assert.equal(after.createdAt,before.createdAt);assert.equal(after.contextOverride,undefined);
  assert.match(buildContext([after]),/New body/);assert.doesNotMatch(buildContext([after]),/User AI instructions|Old body/);
  assert.equal(library.searchIds('instructions').length,0);assert.equal(library.searchIds('New body').length,1);
  assert.equal(after.origin.previewSource,undefined);
  assert.equal(after.origin.author,undefined);assert.equal(after.origin.contentEdited,undefined);
  assert.deepEqual(library.saveCapture(body),result);
  const digest=createHash('sha256').update(body).digest('hex');
  assert.deepEqual(library.lookupCapture(page.url,input.operationId,digest),result);
  assert.throws(()=>library.saveCapture(JSON.stringify({...input,replace:conflict,item:{...page,title:'Altered'}})),/changed/);
  library.editContext(after.id,'');
  const nextConflict=library.lookupCapture(page.url).duplicate;
  library.saveCapture(JSON.stringify({item:{...page,content:'Latest body',preview:undefined},operationId:randomUUID(),replace:nextConflict}));
  const latest=(await library.read())[0];
  assert.equal(latest.preview,undefined);assert.equal(latest.contextOverride,undefined);assert.match(buildContext([latest]),/Latest body/);
});
test('concurrent create/edit/delete cannot bypass confirmation or resurrect a removed card',async t=>{
  const {library}=fixture(t);
  assert.equal(library.lookupCapture(page.url).duplicate,null);
  const inserted=library.saveCapture(JSON.stringify({item:page,operationId:randomUUID()}));
  const conflict=library.lookupCapture(page.url).duplicate;
  const racer=library.saveCapture(JSON.stringify({item:{...page,title:'Other window'},operationId:randomUUID()}));
  assert.equal(racer.duplicate.id,inserted.id);
  library.editMetadata(inserted.id,'Edited elsewhere',['Other']);
  const stale=library.saveCapture(JSON.stringify({item:page,operationId:randomUUID(),replace:conflict}));
  assert.notEqual(stale.duplicate.revision,conflict.revision);
  assert.equal((await library.read())[0].title,'Edited elsewhere');
  library.remove(inserted.id);
  assert.throws(()=>library.saveCapture(JSON.stringify({item:page,operationId:randomUUID(),replace:stale.duplicate})),/changed/);
  assert.equal((await library.read()).length,0);
});
test('new save transfers only one page; timeout is not replayed and retry checks its compact receipt',async t=>{
  const {library}=fixture(t),bridge=startCaptureBridge(library,0);await once(bridge,'listening');
  t.after(async()=>{await new Promise(resolve=>bridge.close(resolve));});
  const headers={'Content-Type':'application/json','X-StashDock-Client':'chrome-extension-v1',Origin:'chrome-extension://'+'a'.repeat(32)};
  assert.equal((await fetch(`http://127.0.0.1:${bridge.address().port}/v1/setup`,{method:'POST',headers,body:JSON.stringify({browser:'chrome',version:'0.4.13',extensionId:'a'.repeat(32)})})).status,200);
  const calls=[],stored={'stashdock-library-v1':{items:[{id:'cached',preview:'large-cache'}]}};let loseReply=true;
  const client=createBrowserLibrary({storage:{get:async()=>structuredClone(stored),set:async value=>Object.assign(stored,value)},fetcher:async(url,options)=>{
    const parsed=new URL(url);calls.push({path:parsed.pathname,method:options.method||'GET'});
    const response=await fetch(`http://127.0.0.1:${bridge.address().port}${parsed.pathname}${parsed.search}`,{...options,headers:{...options.headers,Origin:headers.Origin}});
    if(parsed.pathname==='/v1/capture'&&options.method==='POST'&&loseReply){loseReply=false;await response.json();throw Error('Timed out after commit');}
    return response;
  }});
  const options={operationId:randomUUID()};
  await assert.rejects(client.save(page,options),/Timed out/);
  assert.equal(calls.filter(c=>c.method==='POST'&&c.path==='/v1/capture').length,1);
  assert.equal(stored['stashdock-library-v1'].items,undefined);
  const saved=await client.save(page,options);assert.equal(saved.saved,true);
  assert.equal(calls.filter(c=>c.method==='POST'&&c.path==='/v1/capture').length,1,'receipt avoids uploading the page again');
  const conflict=await client.save({...page,title:'Changed'},{operationId:randomUUID()});assert.ok(conflict.duplicate);
  assert.equal(calls.filter(c=>c.method==='POST'&&c.path==='/v1/capture').length,1,'cancel sends no body/image');
  assert.ok(!calls.some(c=>c.path==='/v1/items'));
  assert.equal((await library.read()).length,1);
});
test('capture validation rejects managed paths and oversized inputs; receipts stay bounded',async t=>{
  const {root,library}=fixture(t);
  for(const item of [{...page,kind:'file'},{...page,assetPath:'private'},{...page,url:'https://user:password@example.org/'},{...page,content:'x'.repeat(20001)},{...page,preview:'https://remote.example/image'}])assert.throws(()=>library.saveCapture(JSON.stringify({item,operationId:randomUUID()})));
  for(let i=0;i<260;i++)library.saveCapture(JSON.stringify({item:{...page,url:'https://example.org/'+i},operationId:randomUUID()}));
  const db=new DatabaseSync(join(root,'stashdock.sqlite3'),{readOnly:true});
  try{assert.equal(db.prepare("SELECT COUNT(*) count FROM app_meta WHERE key LIKE 'browser_capture_receipt_v1:%'").get().count,256);}finally{db.close();}
});

test('Chrome-style GET without Origin cannot block JSON lookup/save, and reads remain non-mutating',async t=>{
  const {library}=fixture(t),bridge=startCaptureBridge(library,0);await once(bridge,'listening');
  t.after(async()=>{await new Promise(resolve=>bridge.close(resolve));});
  const origin='chrome-extension://'+'a'.repeat(32),base=`http://127.0.0.1:${bridge.address().port}`;
  const headers={'Content-Type':'application/json','X-StashDock-Client':'chrome-extension-v1',Origin:origin};
  await fetch(base+'/v1/setup',{method:'POST',headers,body:JSON.stringify({browser:'chrome',version:'0.4.14',extensionId:'a'.repeat(32)})});
  const calls=[];
  const client=createBrowserLibrary({storage:{get:async()=>({}),set:async()=>{}},fetcher:async(url,options)=>{
    const path=new URL(url).pathname;calls.push({path,method:options.method||'GET'});
    // Mimic privileged extension fetch: only non-GET/HEAD gets Origin.
    return fetch(base+path,{...options,headers:{...options.headers,...(options.method==='POST'?{Origin:origin}:{})}});
  }});
  assert.deepEqual(await client.tags(),[]);
  const denied=await fetch(base+'/v1/capture?url=https%3A%2F%2Fexample.org',{headers:{'X-StashDock-Client':'chrome-extension-v1'}});assert.equal(denied.status,403);
  const lookup=await fetch(base+'/v1/capture/lookup',{method:'POST',headers,body:JSON.stringify({url:page.url})});assert.equal(lookup.status,200);assert.equal((await library.read()).length,0);
  const saved=await client.save(page,{operationId:randomUUID()});assert.equal(saved.saved,true);
  assert.ok(calls.some(c=>c.path==='/v1/capture/lookup'&&c.method==='POST'));
  assert.ok(calls.some(c=>c.path==='/v1/tags'&&c.method==='POST'));
  assert.equal(calls.filter(c=>c.path==='/v1/capture').length,1);
  const evil=await fetch(base+'/v1/capture/lookup',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:JSON.stringify({url:page.url})});assert.equal(evil.status,403);
});
test('provider validation errors are not mislabeled as an absent desktop application',async()=>{
  const client=createBrowserLibrary({storage:{get:async()=>({}),set:async()=>{}},fetcher:async()=>Response.json({error:'Invalid URL.'},{status:400})});
  await assert.rejects(client.save(page,{operationId:randomUUID()}),/Invalid URL/);
});
