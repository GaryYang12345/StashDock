import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { realpathSync, mkdtempSync, mkdirSync, cpSync, readFileSync, existsSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import productLinks from '../src-tauri/product-links.json' with { type: 'json' };

const executable=resolve('src-tauri/target/release/stashdock-browser');
const supported=process.platform==='darwin'&&existsSync(executable);
const directories=['Google/Chrome','Microsoft Edge','Mozilla'];
const chromiumIds=[...new Set(['chrome','edge'].flatMap(browser=>[productLinks.browserExtensions[browser].id,...productLinks.browserExtensions[browser].legacyIds]))];

test('Mac installed hosts are independent, relocatable, executable and owned by the current installation', {skip:!supported}, t=>{
  const root=realpathSync(mkdtempSync(join(tmpdir(),'stashdock-native-install-')));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const home=join(root,'用户 Home');
  const env={...process.env,HOME:home,PATH:''};
  delete env.STASHDOCK_NATIVE_HOST_REGISTRATION;
  function copy(folder){const directory=join(root,folder);mkdirSync(directory,{recursive:true});const path=join(directory,'stashdock-browser');cpSync(executable,path);return path;}
  const old=copy('旧 Desktop.app/Contents/MacOS'),current=copy('新 Desktop.app/Contents/MacOS'),plugin=copy('Plugin 安装/bin/darwin-arm64');
  const invoke=(path,action,provider,options={})=>spawnSync(path,[action,provider],{env,...options,encoding:'utf8',timeout:5000});
  const manifest=(browser,provider)=>join(home,'Library/Application Support',browser,'NativeMessagingHosts',`app.stashdock.${provider}.json`);
  for(const [helper,provider] of [[old,'desktop'],[plugin,'plugin'],[current,'desktop']]) {
    const result=invoke(helper,'--register',provider);assert.equal(result.status,0,result.stderr);
  }
  for(const browser of directories) {
    const desktop=JSON.parse(readFileSync(manifest(browser,'desktop'))),other=JSON.parse(readFileSync(manifest(browser,'plugin')));
    assert.equal(desktop.path,current);assert.equal(other.path,plugin);
    assert.equal(desktop.type,'stdio');
    if(browser==='Mozilla')assert.deepEqual(desktop.allowed_extensions,['stashdock@stashdock.app']);
    else {
      assert.deepEqual(desktop.allowed_origins,other.allowed_origins);
      assert.deepEqual(desktop.allowed_origins,chromiumIds.map(id=>`chrome-extension://${id}/`));
      assert.ok(desktop.allowed_origins.every(origin=>/^chrome-extension:\/\/[a-p]{32}\/$/.test(origin)));
    }
  }
  assert.equal(invoke(old,'--unregister','desktop').status,0);
  for(const browser of directories)assert.equal(JSON.parse(readFileSync(manifest(browser,'desktop'))).path,current);
  assert.equal(invoke(current,'--unregister','desktop').status,0);
  for(const browser of directories){assert.equal(existsSync(manifest(browser,'desktop')),false);assert.equal(existsSync(manifest(browser,'plugin')),true);}
  assert.equal(invoke(plugin,'--register','desktop',{env:{...env,STASHDOCK_NATIVE_HOST_REGISTRATION:'off'}}).status,0);
  for(const browser of directories)assert.equal(existsSync(manifest(browser,'desktop')),false,'isolated fixture cannot register');
  assert.equal(existsSync(join(home,'Library/Application Support/app.stashdock.desktop')),false,'registration never creates or opens a library');
  assert.equal(invoke(plugin,'--unregister','plugin').status,0);
  for(const browser of directories)assert.equal(existsSync(manifest(browser,'plugin')),false);
  const noExec=copy('Invalid');chmodSync(noExec,0o600);
  assert.ok(invoke(noExec,'--register','desktop').error,'the OS refuses a non-executable helper');
});

test('Mac helper authorizes current and exact legacy Chromium callers and rejects unrelated callers', {skip:!supported}, t=>{
  const home=mkdtempSync(join(tmpdir(),'stashdock-native-callers-'));t.after(()=>rmSync(home,{recursive:true,force:true}));
  const request=Buffer.from(JSON.stringify({path:'/health'})),size=Buffer.alloc(4);size.writeUInt32LE(request.length);
  for(const id of [...chromiumIds,'a'.repeat(32)]) {
    const result=spawnSync(executable,[`chrome-extension://${id}/`],{env:{...process.env,HOME:home},input:Buffer.concat([size,request]),timeout:15000});
    if(id==='a'.repeat(32)){assert.notEqual(result.status,0);assert.equal(result.stdout.length,0);}
    else {assert.equal(result.status,0,result.stderr.toString());assert.equal(JSON.parse(result.stdout.subarray(4)).value.ok,true);}
  }
});

test('Mac Safari helper accepts only the exact containing-extension caller', {skip:!supported}, t=>{
 const home=mkdtempSync(join(tmpdir(),'stashdock-safari-caller-'));t.after(()=>rmSync(home,{recursive:true,force:true}));
 const request=Buffer.from(JSON.stringify({path:'/health'})),size=Buffer.alloc(4);size.writeUInt32LE(request.length);
 for(const [args,valid] of [[['--safari-extension','app.stashdock.desktop.SafariExtension'],true],[['--safari-extension','app.stashdock.foreign'],false],[['--safari-extension'],false],[['--safari-extension','app.stashdock.desktop.SafariExtension','extra'],false]]){
  const r=spawnSync(executable,args,{env:{...process.env,HOME:home,STASHDOCK_NATIVE_HOST_REGISTRATION:'off'},input:Buffer.concat([size,request]),timeout:15000});
  assert.ifError(r.error);if(valid){assert.equal(r.status,0,r.stderr.toString());assert.equal(JSON.parse(r.stdout.subarray(4)).value.ok,true);}else{assert.notEqual(r.status,0);assert.equal(r.stdout.length,0);}
 }
});
