import test from 'node:test';import assert from 'node:assert/strict';
import {createSafariNativeClient} from '../extension/safari-native.js';
import {createBrowserLibrary} from '../extension/library-client.js';
import {checkSetup,checkProvider} from '../extension/setup-client.js';

test('Safari saves through its native extension with both HTTP providers absent',async()=>{
 const calls=[];const native=createSafariNativeClient({sendNativeMessage:async(host,packet)=>{
  calls.push({host,packet});return {ok:true,value:packet.path==='/setup'?{connected:true,integrations:{items:[]}}:packet.path==='/health'?{ok:true,name:'StashDock'}:packet.path==='/tags'?{tags:['QA']}:packet.path==='/capture/lookup'?{duplicate:null}:{saved:true,id:'native-save'}};
 }});const fetcher=()=>assert.fail('No HTTP provider');
 assert.equal((await checkSetup({native,fetcher,browser:'safari',version:'0.4.22'})).connected,true);
 assert.deepEqual(await checkProvider({native,fetcher}),{connected:true});
 const library=createBrowserLibrary({native,fetcher,storage:{get:async()=>({}),set:async()=>{}}});
 assert.deepEqual(await library.tags(),['QA']);assert.equal((await library.save({url:'https://example.org/'},{operationId:'op-123456789'})).id,'native-save');
 assert.equal(calls.filter(c=>c.packet.path==='/capture').length,1);assert.ok(calls.every(c=>c.host==='app.stashdock.desktop'&&!('port' in c.packet)));
});
test('Safari ambiguous saves and logical errors never select another provider or replay a write',async()=>{
 const calls=[];const native=createSafariNativeClient({sendNativeMessage:async(_,packet)=>{calls.push(packet);if(packet.path==='/capture')throw Error('Connection lost');return {ok:true,value:{duplicate:null}};}});
 const library=createBrowserLibrary({native,fetcher:()=>assert.fail('No replay via HTTP'),storage:{get:async()=>({}),set:async()=>{}}});
 await assert.rejects(library.save({url:'https://example.org/'},{operationId:'op-123456789'}),/Connection lost/);assert.equal(calls.filter(p=>p.path==='/capture').length,1);
 const broken=createSafariNativeClient({sendNativeMessage:async()=>({ok:false,error:'The moved library is unavailable.'})});
 assert.equal((await checkProvider({native:broken,fetcher:()=>assert.fail('No second library')})).error,'The moved library is unavailable.');
});
test('Safari rejects arbitrary targets and oversized input before native messaging',async()=>{
 let calls=0;const native=createSafariNativeClient({sendNativeMessage:async()=>{calls++;return {ok:true,value:{}};}});
 for(const [path,body] of [['/items','{}'],['https://example.org/',undefined],['/capture',{}],['/capture','中'.repeat(333334)]])await assert.rejects(native.query(path,body));
 await assert.rejects(native.at('native:other','/health'));assert.equal(calls,0);
 await assert.rejects(createSafariNativeClient({sendNativeMessage(){throw Error('Synchronous launch failure');}}).query('/health'),/Synchronous/);
 await assert.rejects(createSafariNativeClient({sendNativeMessage:async()=>({status:400,body:'{}'})}).query('/health'),/Restart Safari/);
});
