import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeClient } from '../extension/native-client.js';
import { createBrowserLibrary } from '../extension/library-client.js';
import { checkProvider } from '../extension/setup-client.js';

function runtime(handler) {
  const calls = [], api = {lastError:undefined};
  api.connectNative = host => {
    const messages=[],disconnects=[];
    let closed=false;
    const port={onMessage:{addListener:f=>messages.push(f)},onDisconnect:{addListener:f=>disconnects.push(f)},disconnect(){closed=true;},postMessage(request){
      calls.push({host,request});
      queueMicrotask(()=>handler({host,request,reply:value=>{if(!closed)messages.forEach(f=>f(value));},fail:message=>{if(closed)return;api.lastError={message};disconnects.forEach(f=>f());api.lastError=undefined;}}));
    }};
    return port;
  };
  return {api,calls};
}
test('with both apps closed the native provider performs compact reads and one save, with no HTTP request', async()=>{
  const {api,calls}=runtime(({request,reply})=>reply({ok:true,value:request.path==='/health'?{ok:true,name:'StashDock'}:request.path==='/tags'?{tags:['Design']}:request.path==='/capture/lookup'?{duplicate:null}:{saved:true,id:'saved'}}));
  const native=createNativeClient(api);
  assert.deepEqual(await checkProvider({native,fetcher:()=>{throw Error('No app is running');}}),{connected:true});
  const library=createBrowserLibrary({native,storage:{get:async()=>({}),set:async()=>{}},fetcher:()=>{throw Error('Must not call HTTP');}});
  assert.deepEqual(await library.tags(),['Design']);
  assert.equal((await library.save({url:'https://example.org/'},{operationId:'operation-123456789'})).saved,true);
  assert.deepEqual(calls.map(c=>c.request.path),['/health','/tags','/capture/lookup','/capture']);
});
test('a plugin-only installation works when the desktop native host is missing',async()=>{
  const {api,calls}=runtime(({host,reply,fail})=>host.endsWith('.desktop')?fail('Specified native messaging host not found.'):reply({ok:true,value:{tags:[]}}));
  const result=await createNativeClient(api).query('/tags','{}');
  assert.equal(result.base,'native:app.stashdock.plugin');
  assert.equal(calls.length,2);
});
test('an uncertain native write is never replayed through another host or HTTP',async()=>{
  const {api,calls}=runtime(({request,reply,fail})=>request.path==='/capture'?fail('Native host has exited.'):reply({ok:true,value:{duplicate:null}}));
  const library=createBrowserLibrary({native:createNativeClient(api),storage:{get:async()=>({}),set:async()=>{}},fetcher:()=>{throw Error('No HTTP replay');}});
  await assert.rejects(library.save({url:'https://example.org/'},{operationId:'operation-123456789'}),/exited/);
  assert.equal(calls.filter(c=>c.request.path==='/capture').length,1);
  assert.ok(calls.every(c=>c.host==='app.stashdock.desktop'));
});
test('native logical errors are preserved and cannot fall through to a second library',async()=>{
  const {api,calls}=runtime(({reply})=>reply({ok:false,error:'The moved library is unavailable.'}));
  await assert.rejects(createNativeClient(api).query('/tags','{}'),/moved library/);
  assert.equal(calls.length,1);
});
test('a crashed native reader can use the other installed product before any mutation begins',async()=>{
  const {api,calls}=runtime(({host,reply,fail})=>host.endsWith('.desktop')?fail('Native host has exited.'):reply({ok:true,value:{duplicate:null}}));
  const result=await createNativeClient(api).query('/capture/lookup','{}');
  assert.equal(result.base,'native:app.stashdock.plugin');
  assert.equal(calls.length,2);
});

test('synchronous native launch errors can try the other provider without classifying browser wording',async()=>{
  const {api,calls}=runtime(({reply})=>reply({ok:true,value:{tags:[]}}));
  const connect=api.connectNative,attempts=[];
  api.connectNative=host=>{
    attempts.push(host);
    if(host.endsWith('.desktop'))throw Error('Localized browser launch error');
    return connect(host);
  };
  assert.equal((await createNativeClient(api).query('/tags','{}')).base,'native:app.stashdock.plugin');
  assert.deepEqual(attempts,['app.stashdock.desktop','app.stashdock.plugin']);
  assert.equal(calls.length,1);
});

test('native setup and health library errors stay visible and never fall back to HTTP', async()=>{
  const {checkSetup}=await import('../extension/setup-client.js');
  const {api,calls}=runtime(({reply})=>reply({ok:false,error:'The moved library is unavailable.'}));
  const options={native:createNativeClient(api),fetcher:()=>assert.fail('No fallback after a library error')};
  assert.equal((await checkSetup(options)).error,'The moved library is unavailable.');
  assert.equal((await checkProvider(options)).error,'The moved library is unavailable.');
  assert.equal(calls.length,2);
});
