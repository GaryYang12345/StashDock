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
const page={id:'draft',title:'New title',kind:'web',source:'Example',url:'https://example.org/post?utm_source=a#reply',content:'New body',excerpt:'New body',tags:['New'],createdAt:'2026-10-16T00:00:00Z',preview:'data:image/jpeg;base64,AAAA',origin:{previewKind:'screenshot'}};
test('canonical URL keys match native query encoding and remove empty legacy queries',()=>{
  assert.equal(canonicalReferenceUrl('https://example.org/post?'),'https://example.org/post');
  assert.equal(canonicalReferenceUrl('https://example.org/post?q=hello%20world'),'https://example.org/post?q=hello%20world');
});
function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'stashdock-mcp-test-save-confirm-'));
  const library=createLocalLibrary({dataDir:root,browserEnabled:()=>true});
  t.after(()=>{library.close();rmSync(root,{recursive:true,force:true});});
  return {root,library};
}
test('duplicate check is bounded; keep existing writes nothing; replace preserves identity and AI context',async t=>{
  const {library}=fixture(t);
  const existing=library.importItems([{...page,title:'Old title',content:'Old body',tags:['Old'],preview:undefined,origin:{previewSource:'custom'}}]).items[0];
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
  assert.equal(after.id,before.id);assert.equal(after.favorite,true);assert.equal(after.createdAt,before.createdAt);assert.equal(after.contextOverride,'User AI instructions');
  assert.equal(after.origin.previewSource,undefined);
  assert.deepEqual(library.saveCapture(body),result);
  const digest=createHash('sha256').update(body).digest('hex');
  assert.deepEqual(library.lookupCapture(page.url,input.operationId,digest),result);
  assert.throws(()=>library.saveCapture(JSON.stringify({...input,replace:conflict,item:{...page,title:'Altered'}})),/changed/);
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
    if(options.method==='POST'&&loseReply){loseReply=false;await response.json();throw Error('Timed out after commit');}
    return response;
  }});
  const options={operationId:randomUUID()};
  await assert.rejects(client.save(page,options),/Timed out/);
  assert.equal(calls.filter(c=>c.method==='POST').length,1);
  assert.equal(stored['stashdock-library-v1'].items,undefined);
  const saved=await client.save(page,options);assert.equal(saved.saved,true);
  assert.equal(calls.filter(c=>c.method==='POST').length,1,'receipt avoids uploading the page again');
  const conflict=await client.save({...page,title:'Changed'},{operationId:randomUUID()});assert.ok(conflict.duplicate);
  assert.equal(calls.filter(c=>c.method==='POST').length,1,'cancel sends no body/image');
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
