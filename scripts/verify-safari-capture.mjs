// Actual signed sandbox client -> private signed XPC -> packaged Rust helper.
// This is not actual Safari activation; that remains an installed UI check.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,mkdir,readFile,writeFile,cp,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {buildSafariCapture} from './build-safari-capture.mjs';
import {createLocalLibrary} from '../plugins/stashdock/server/local-library.mjs';
import {createSafariNativeClient} from '../extension/safari-native.js';
import {createBrowserLibrary} from '../extension/library-client.js';
import {checkSetup} from '../extension/setup-client.js';
const identity=process.env.APPLE_SIGNING_IDENTITY;
if(process.platform!=='darwin'||!identity)throw Error('Use a local Apple signing identity on macOS.');
const root=await realpath(await mkdtemp(join(tmpdir(),'stashdock-safari-xpc-'))),home=join(root,'home'),dataDir=join(root,'library'),app=join(root,'Client.app');
const marker='Safari-XPC-'+randomUUID(),helper=resolve(process.argv[2]||'src-tauri/target/release/stashdock-browser');
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{encoding:'utf8',timeout:60000});if(r.error)throw r.error;assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout;};
const clients=[];
async function client(bundle){
 const child=spawn(join(bundle,'Contents/MacOS/client'),[],{stdio:['pipe','pipe','pipe']});clients.push(child);
 const lines=createInterface({input:child.stdout}),pending=[];let readyResolve,readyReject,stderr='';
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 lines.on('line',line=>{try{const value=JSON.parse(line);if(value.started)readyResolve(value);else pending.shift()?.resolve(value);}catch(error){pending.shift()?.reject(error);}});
 child.stderr.on('data',data=>{stderr=(stderr+data).slice(-4000);});
 child.on('error',readyReject);child.on('exit',code=>{readyReject(Error('Client exited '+code+': '+stderr));for(const waiter of pending.splice(0))waiter.reject(Error('Client exited '+code));});
 const started=await Promise.race([ready,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Sandbox client startup timed out: '+stderr)),15000);t.unref();})]);
 assert.equal(started.sandboxDeniedOwnedLibrary,true,'The sandbox client must not directly read the library.');
 return {child,request:packet=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Native reply timed out: '+stderr)),16000);pending.push({resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});child.stdin.write(JSON.stringify(packet)+'\n');}),close:async()=>{const exit=new Promise(resolve=>child.once('close',resolve));child.stdin.end();await exit;}};
}
try {
 await mkdir(home);await mkdir(join(app,'Contents/MacOS'),{recursive:true});
 const library=createLocalLibrary({dataDir});library.importItems([{kind:'web',title:'Isolation marker',url:'https://example.org/'+marker,tags:[marker]}]);library.close();
 const info={CFBundleIdentifier:'app.stashdock.desktop.SafariExtension',CFBundleExecutable:'client',CFBundleVersion:'1',CFBundlePackageType:'APPL',LSBackgroundOnly:true,StashDockQAProbe:join(dataDir,'stashdock.sqlite3')};
 await writeFile(join(app,'Contents/Info.plist'),JSON.stringify(info));run('plutil',['-convert','xml1',join(app,'Contents/Info.plist')]);
 const entitlements=join(root,'sandbox.entitlements');await writeFile(entitlements,'<?xml version="1.0"?><plist version="1.0"><dict><key>com.apple.security.app-sandbox</key><true/></dict></plist>');
 run('xcrun',['swiftc','-parse-as-library','-O','-target',`${process.arch==='arm64'?'arm64':'x86_64'}-apple-macos14.0`,'safari/SafariCaptureProtocol.swift','safari/SafariWebExtensionHandler.swift','tests/safari-capture-client.swift','-o',join(app,'Contents/MacOS/client')]);
 await buildSafariCapture({extension:app,identity,version:'1',helper,fixture:{home,library:dataDir}});
 const sign=bundle=>run('codesign',['--force','--sign',identity,'--options','runtime','--timestamp=none','--entitlements',entitlements,bundle]);sign(app);
 const source=await client(app);const api=createSafariNativeClient({sendNativeMessage:(_host,packet)=>source.request(packet)});
 assert.ok((await api.query('/tags')).value.tags.includes(marker),'Attest the owned library before any setup/save.');
 assert.equal((await checkSetup({native:api,fetcher:()=>assert.fail('HTTP forbidden')})).connected,true);
 const browser=createBrowserLibrary({native:api,storage:{get:async()=>({}),set:async()=>{}},fetcher:()=>assert.fail('HTTP forbidden')});
 const item={id:'draft',title:'Native Safari save',kind:'web',source:'Example',url:'https://example.org/safari-xpc/'+marker,content:'Saved with neither Desktop nor an AI service involved.',excerpt:'',tags:['Safari QA'],createdAt:new Date().toISOString(),favorite:false},operationId=randomUUID();
 const saved=await browser.save(item,{operationId});assert.equal(saved.saved,true);assert.deepEqual(await browser.save(item,{operationId}),saved);
 const duplicate=await browser.save({...item,title:'Unconfirmed change'},{operationId:randomUUID()});assert.equal(duplicate.duplicate.id,saved.id);
 const replacement={...item,content:'Confirmed native replacement'},replaceOperation=randomUUID();
 const replaced=await browser.save(replacement,{operationId:replaceOperation,replace:duplicate.duplicate});assert.equal(replaced.replaced,true);assert.deepEqual(await browser.save(replacement,{operationId:replaceOperation,replace:duplicate.duplicate}),replaced);
 // Keep the sandbox client alive; the service itself must become idle and exit.
 const servicePath=join(app,'Contents/XPCServices/StashDockCapture.xpc/Contents/MacOS/StashDockCapture');
 const running=run('ps',['-axo','command=']).split('\n').filter(row=>row.startsWith(servicePath));assert.equal(running.length,1,'Observe the real service before checking idle exit.');
 let idle=false;const start=Date.now();while(Date.now()-start<5000){const rows=run('ps',['-axo','command=']).split('\n');if(!rows.some(row=>row.startsWith(servicePath))){idle=true;break;}await new Promise(resolve=>setTimeout(resolve,100));}
 const idleElapsed=Date.now()-start;assert.equal(idle,true,'The capture service must exit while its client remains alive.');
 await source.close();
 const restarted=await client(app);const after=createSafariNativeClient({sendNativeMessage:(_host,packet)=>restarted.request(packet)});
 const again=createBrowserLibrary({native:after,storage:{get:async()=>({}),set:async()=>{}},fetcher:()=>assert.fail('HTTP forbidden')});
 assert.deepEqual(await again.save(replacement,{operationId:replaceOperation,replace:duplicate.duplicate}),replaced);await restarted.close();
 const foreign=join(root,'Foreign.app');await cp(app,foreign,{recursive:true});info.CFBundleIdentifier='app.stashdock.safari.capture.foreign';await writeFile(join(foreign,'Contents/Info.plist'),JSON.stringify(info));run('plutil',['-convert','xml1',join(foreign,'Contents/Info.plist')]);sign(foreign);
 const rejected=await client(foreign),denial=await rejected.request({path:'/health'});assert.equal(denial.ok,false,'Same-team foreign app must be rejected by the XPC peer requirement.');await rejected.close();
 const db=new DatabaseSync(join(dataDir,'stashdock.sqlite3'),{readOnly:true});try{assert.equal(db.prepare('SELECT COUNT(*) n FROM stash_items').get().n,2);assert.equal(db.prepare('SELECT content FROM stash_items WHERE id=?').get(saved.id).content,replacement.content);assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');}finally{db.close();}
 console.log(JSON.stringify({signedSandboxClient:true,directLibraryAccessDenied:true,actualPrivateXPC:true,actualPackagedRustHelper:true,scopeAttested:true,saveDuplicateReplaceRetry:true,restartReceipt:true,foreignSignedCallerRejected:true,idleExitWhileClientAlive:true,idleObservedMs:idleElapsed,rows:2,httpProviderCalls:0,actualSafariActivation:false}));
} finally {
 for(const child of clients)if(child.exitCode===null){child.stdin.end();child.kill('SIGTERM');}
 await rm(root,{recursive:true,force:true});
}
