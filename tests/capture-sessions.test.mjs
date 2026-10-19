import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaptureSessions} from '../extension/capture-sessions.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(capture=async(_api,expected)=>({url:expected.url,content:'Actual article',preview:'screenshot'})) {
  const saved={},tab={id:7,windowId:2,url:'https://one.example/article',status:'complete'};
  const api={tabs:{query:async()=>[{...tab}]},storage:{session:{get:async key=>structuredClone({[key]:saved[key]}),set:async value=>Object.assign(saved,structuredClone(value)),remove:async key=>{delete saved[key];}}}};
  return {saved,tab,sessions:createCaptureSessions(api,capture,()=>{},async()=>{await tick();})};
}
test('current-page reads replace another website, keep cached drafts, and Retry starts a fresh current-page task',async()=>{
  let captures=0;const f=fixture(async(_api,e)=>{captures++;return {url:e.url,content:'Body'+captures};});
  const first=await f.sessions.read(2);await tick();
  assert.equal((await f.sessions.read(2)).token,first.token);assert.equal(captures,1);
  f.tab.id=8;f.tab.url='https://two.example/post';
  await f.sessions.read(2,true);await tick();
  assert.equal(f.saved['stashdock-sidepanel:2'].page.url,f.tab.url);assert.equal(captures,2);
  await f.sessions.read(2,true);await tick();assert.equal(captures,3);
});
test('slow old tasks cannot overwrite a newer tab or resurrect a closed sidebar',async()=>{
  let release;const f=fixture(async(_api,e)=>e.tabId===7?new Promise(resolve=>{release=()=>resolve({url:e.url,content:'Old page'});}):{url:e.url,content:'New page'});
  await f.sessions.read(2);await tick();
  f.tab.id=8;f.tab.url='https://two.example/post';await f.sessions.read(2,true);await tick();
  release();await tick();assert.equal(f.saved['stashdock-sidepanel:2'].page.content,'New page');
  f.tab.id=7;await f.sessions.read(2,true);await tick();await f.sessions.close(2);release();await tick();
  assert.equal(f.saved['stashdock-sidepanel:2'],undefined);
});
test('page loading waits before extraction; failed/login pages can be retried without reopening',async()=>{
  const f=fixture(async(_api,e)=>{if(f.tab.loginRequired)throw Error('Sign in to read this post.');return {url:e.url,content:'Loaded body'};});
  f.tab.status='loading';const entry=await f.sessions.read(2);assert.equal(entry.loading,true);
  f.tab.status='complete';await tick();await tick();assert.equal(f.saved['stashdock-sidepanel:2'].page.content,'Loaded body');
  f.tab.loginRequired=true;await f.sessions.read(2,true);await tick();assert.match(f.saved['stashdock-sidepanel:2'].error,/Sign in/);
  f.tab.loginRequired=false;await f.sessions.read(2,true);await tick();assert.equal(f.saved['stashdock-sidepanel:2'].error,undefined);
});
test('restricted/unauthorized URLs do not call the reader',async()=>{
  let reads=0;const f=fixture(async()=>{reads++;});f.tab.url='chrome://settings/';await f.sessions.read(2);await tick();
  assert.equal(reads,0);assert.match(f.saved['stashdock-sidepanel:2'].error,/unavailable/);
});
test('closing also cancels a read queued behind authorization or tab lookup',async()=>{
  const f=fixture();const epoch=f.sessions.epoch(2);await f.sessions.close(2);
  await assert.rejects(f.sessions.read(2,true,epoch),/closed/);
  assert.equal(f.saved['stashdock-sidepanel:2'],undefined);
});
test('a loading record orphaned by worker restart starts a new task rather than looping forever',async()=>{
  const f=fixture();f.saved['stashdock-sidepanel:2']={token:'orphan',loading:true,expected:{tabId:7,windowId:2,url:f.tab.url}};
  const fresh=await f.sessions.read(2);assert.notEqual(fresh.token,'orphan');await tick();assert.equal(f.saved['stashdock-sidepanel:2'].loading,false);
});
test('same-document body updates enrich the source and recover a previously unreadable post',async()=>{
  let text='Partial';const f=fixture(async(_api,e,_resize,_pause,_current,options)=>{options.onDocument('doc');return {url:e.url,content:text};});
  const entry=await f.sessions.read(2);await tick();text='Full post with all paragraphs';await f.sessions.refresh(2,entry.token,'doc');
  assert.equal(f.saved['stashdock-sidepanel:2'].page.content,text);assert.equal(f.saved['stashdock-sidepanel:2'].revision,1);
  await f.sessions.refresh(2,'stale-token','doc');assert.equal(f.saved['stashdock-sidepanel:2'].revision,1);
});
test('a late update during screenshot/enrichment is queued, not lost',async()=>{
  let release,count=0;
  const f=fixture(async(_api,e,_resize,_pause,_current,options)=>{options.onDocument('doc');if(++count===2)await new Promise(resolve=>{release=resolve;});return {url:e.url,content:'Body '+count};});
  const entry=await f.sessions.read(2);await tick();const pending=f.sessions.refresh(2,entry.token,'doc');await tick();await f.sessions.refresh(2,entry.token,'doc');release();await pending;await tick();await tick();assert.equal(count,3);assert.equal(f.saved['stashdock-sidepanel:2'].page.content,'Body 3');
});

test('body arriving during the first screenshot is captured after initial loading finishes',async()=>{
  let release,count=0;
  const f=fixture(async(_api,e,_resize,_pause,_current,options)=>{options.onDocument('doc');const n=++count;if(n===1)await new Promise(resolve=>{release=resolve;});return {url:e.url,content:n===1?'Partial':'Complete'};});
  const entry=await f.sessions.read(2);await tick();
  await f.sessions.refresh(2,entry.token,'doc');release();
  await tick();await tick();await tick();
  assert.equal(count,2);assert.equal(f.saved['stashdock-sidepanel:2'].page.content,'Complete');
});
