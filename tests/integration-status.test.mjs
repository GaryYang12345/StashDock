import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createIntegrationStatusReader } from '../plugins/stashdock/server/integration-status.mjs';

function fixture(options = {}) {
  let reads = 0;
  const library = { integrations: () => { reads++; return { platform:'macos', items:[{id:'safari',detected:true,version:'old'},{id:'chrome',detected:true}] }; }, desktopExecutable: () => '/recorded/StashDock.app/Contents/MacOS/stashdock' };
  return { read: createIntegrationStatusReader(library, { platform:'darwin', resolveApp:async()=>({application:'/Applications/StashDock.app',safariStatusProbe:true}), ...options }), reads:()=>reads };
}

test('Safari status uses only the fixed containing-app query and preserves peer integrations', async () => {
  const calls = [];
  const f = fixture({ resolveApp: async (...args) => { calls.push(args); return {application:'/Applications/StashDock.app',safariStatusProbe:true}; }, run:async (...args) => { calls.push(args); return {protocolVersion:1,enabled:true}; } });
  const info = await f.read();
  assert.deepEqual(calls[0], ['desktop','/recorded/StashDock.app/Contents/MacOS/stashdock']);
  assert.equal(calls[1][0], join('/Applications/StashDock.app', 'Contents/MacOS/stashdock'));
  assert.deepEqual(calls[1][1], {integrationOperation:'safari-state'});
  assert.deepEqual(calls[1][3], {args:['--safari-extension-state'],maxOutput:4096,timeout:5000});
  assert.deepEqual(info.items, [{id:'safari',detected:true},{id:'chrome',detected:true}]);
});

test('missing and old Desktop bundles are not launched with an unknown flag', async () => {
  for (const app of [{application:null,safariStatusProbe:false},{application:'/Applications/Old.app',safariStatusProbe:false}]) {
    const f = fixture({ resolveApp:async()=>app, run:async()=>assert.fail('Old/missing app must not launch') });
    assert.equal((await f.read()).items[0].detected, false);
  }
});

test('disabled, malformed, unavailable and timed-out states cannot resurrect a historical detection', async () => {
  for (const result of [{protocolVersion:1,enabled:false},{protocolVersion:2,enabled:true},{enabled:true},{protocolVersion:1,enabled:'true'},null]) {
    const f = fixture({ run:async()=>result });
    assert.equal((await f.read()).items[0].detected, false);
  }
  for (const error of ['Screenshot timed out','Service unavailable']) {
    const f = fixture({ run:async()=>{throw Error(error);} });
    assert.equal((await f.read()).items[0].detected, false);
  }
});

test('refreshes coalesce only in flight and observe disable/re-enable without a result cache', async () => {
  let calls = 0, release;
  const f = fixture({ run:()=> { calls++; return new Promise(resolve=>{release=resolve;}); } });
  const a = f.read(), b = f.read();
  assert.equal(a,b);
  await Promise.resolve();
  release({protocolVersion:1,enabled:true});
  assert.equal((await a).items[0].detected,true);
  const disabled = f.read(); await Promise.resolve(); release({protocolVersion:1,enabled:false});
  assert.equal((await disabled).items[0].detected,false);
  const enabled = f.read(); await Promise.resolve(); release({protocolVersion:1,enabled:true});
  assert.equal((await enabled).items[0].detected,true);
  assert.equal(calls,3); assert.equal(f.reads(),3);
});

test('other platforms do not invoke Mac services', async () => {
  const f = fixture({platform:'win32',resolveApp:async()=>assert.fail('No Mac lookup'),run:async()=>assert.fail('No Mac query')});
  assert.equal((await f.read()).items[0].detected,true);
});
