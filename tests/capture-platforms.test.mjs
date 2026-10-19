import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { customCapturePlatform, captureSites } from '../src/lib/captureSites.ts';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { openCaptureSite } from '../plugins/stashdock/server/open-capture-site.mjs';
import { EventEmitter } from 'node:events';

test('custom platforms are persistent, deduplicated shared preferences, not references', async t => {
  const root=mkdtempSync(join(tmpdir(),'stashdock-mcp-test-platforms-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  let library=createLocalLibrary({dataDir:root});
  const values=library.saveCapturePlatform('example.org/account');
  assert.equal(values[0].name,'example.org');
  assert.equal(library.saveCapturePlatform('https://example.org/account').length,1);
  assert.equal((await library.read()).length,0);
  library.close();library=createLocalLibrary({dataDir:root});
  assert.deepEqual(library.listCapturePlatforms(),values);
  for(const raw of ['javascript:alert(1)','file:///C:/private','https://name:password@example.org','localhost','']) assert.throws(()=>library.saveCapturePlatform(raw));
  const launched=[];
  const launch=(command,args,options)=>{launched.push({command,args,options});const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child;};
  await openCaptureSite(values[0].id,{customPlatforms:values,launch,platform:'win32'});
  assert.equal(launched[0].args[1],values[0].url);assert.equal(launched[0].options.shell,false);
  await assert.rejects(openCaptureSite('custom:https://not-saved.example/',{customPlatforms:values,launch}));
  library.close();
});
test('platform choices exclude WeChat and use validated default-browser destinations',()=>{
  assert.deepEqual(captureSites.map(value=>value.id),['x','instagram','reddit','linkedin','pinterest','xiaohongshu','zhihu']);
  for(const site of captureSites)assert.equal(customCapturePlatform(site.url).url,site.url);
});
