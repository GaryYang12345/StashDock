import test from 'node:test';
import assert from 'node:assert/strict';
import { createFirefoxFetcher } from '../extension/firefox-provider.js';
import { firefoxNativeHost, firefoxNativeOrigin, firefoxExtensionId, browserRegistration } from '../src/lib/browser-extension-identity.mjs';
import { browserInstallationRecord, registeredBrowserOrigin } from '../plugins/stashdock/server/integrations.mjs';
import { checkProvider } from '../extension/setup-client.js';

test('Firefox native registration verifies the fixed identity without opening browser profiles', () => {
  const record = browserInstallationRecord(() => null,'firefox','0.4.19',firefoxExtensionId,firefoxNativeOrigin,
    () => assert.fail('Native caller authorization must not inspect profiles'));
  assert.equal(browserRegistration('firefox',firefoxNativeOrigin,firefoxExtensionId),firefoxExtensionId);
  assert.equal(registeredBrowserOrigin(key => key === record.key ? record.value : null,firefoxNativeOrigin),true);
  for(const [id,origin] of [['other@example.org',firefoxNativeOrigin],[firefoxExtensionId,firefoxNativeOrigin+'-other'],[firefoxExtensionId,'https://example.org']]) {
    assert.throws(() => browserInstallationRecord(() => null,'firefox','0.4.19',id,origin,() => false));
  }
  assert.throws(() => browserInstallationRecord(() => null,'chrome','0.4.19',firefoxExtensionId,firefoxNativeOrigin,() => false));
});

test('Firefox permission refusal has an actionable hint and never launches a native process', async () => {
  const fetcher=createFirefoxFetcher({permissions:{contains:async()=>false},runtime:{sendNativeMessage:()=>assert.fail('No permission')}});
  const state=await checkProvider({fetcher});
  assert.equal(state.connected,false);assert.match(state.error,/Firefox toolbar/);
});

test('Firefox uses the same bounded capture RPC for both providers and never transfers arbitrary targets', async () => {
  const calls=[];
  const fetcher=createFirefoxFetcher({permissions:{contains:async()=>true},runtime:{sendNativeMessage:async(name,message)=>{
    calls.push({name,message});return {status:200,body:JSON.stringify({saved:true,id:'same-id'})};
  }}});
  for(const port of [17863,17864]) for(const path of ['/v1/setup','/v1/capture/lookup','/v1/capture','/v1/tags']) {
    const value=await fetcher(`http://127.0.0.1:${port}${path}`,{method:'POST',body:'{"content":"中文"}'});
    assert.deepEqual(await value.json(),{saved:true,id:'same-id'});
    assert.deepEqual(calls.at(-1),{name:firefoxNativeHost,message:{method:'POST',path,port,body:'{"content":"中文"}'}});
  }
  const count=calls.length;
  for(const url of ['https://example.org/v1/setup','http://localhost:17863/v1/setup','http://127.0.0.1:17865/v1/setup','http://127.0.0.1:17863/v1/items','http://127.0.0.1:17863/v1/setup?host=evil']) {
    await assert.rejects(fetcher(url,{method:'POST',body:'{}'}),/Invalid StashDock/);
  }
  await assert.rejects(fetcher('http://127.0.0.1:17863/v1/capture',{method:'POST',body:'中'.repeat(400_000)}),/Invalid StashDock/);
  assert.equal(calls.length,count);
});

test('aborting a pending native Save rejects once and never replays the write', async () => {
  let finish, calls=0;
  const fetcher=createFirefoxFetcher({permissions:{contains:async()=>true},runtime:{sendNativeMessage:()=>{
    ++calls;return new Promise(resolve=>{finish=resolve;});
  }}});
  const controller=new AbortController();
  const pending=fetcher('http://127.0.0.1:17863/v1/capture',{method:'POST',body:'{}',signal:controller.signal});
  await new Promise(resolve=>setImmediate(resolve));controller.abort();
  await assert.rejects(pending,/cancelled/);finish({status:200,body:'{"saved":true}'});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
});

test('cancellation during permission lookup never starts the native write', async () => {
  let allow;
  const fetcher=createFirefoxFetcher({permissions:{contains:()=>new Promise(resolve=>{allow=resolve;})},runtime:{sendNativeMessage:()=>assert.fail('Cancelled before native launch')}});
  const controller=new AbortController();
  const pending=fetcher('http://127.0.0.1:17863/v1/capture',{method:'POST',body:'{}',signal:controller.signal});
  controller.abort();allow(true);await assert.rejects(pending,/cancelled/);
});
