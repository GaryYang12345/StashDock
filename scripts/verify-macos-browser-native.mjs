// Actual Chrome/Edge/Firefox Native Messaging in disposable profiles. Test-only host names
// make it impossible to select an installed product or the user's real library.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { spawnSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createNativeRecovery } from './lib/macos-native-recovery.mjs';
import { DatabaseSync } from 'node:sqlite';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';

if(process.platform!=='darwin')throw Error('Run the Mac browser acceptance on macOS.');
const [browser,playwrightPath,helperPath,desktopHelperPath]=process.argv.slice(2);
if(!['chrome','edge','firefox'].includes(browser)||!playwrightPath)throw Error('Usage: node scripts/verify-macos-browser-native.mjs chrome|edge|firefox /path/to/playwright-core/index.mjs-or-web-ext.js [packaged-helper]');
const helper=resolve(helperPath||'src-tauri/target/release/stashdock-browser');
const root=await realpath(await mkdtemp(join(tmpdir(),'stashdock-native-real-browser-')));
const home=join(root,'用户 Home'),profile=join(root,'browser'),extension=join(root,'extension');
const suffix='qa'+randomBytes(8).toString('hex');
const marker='QAFixture-'+suffix;
const env={...process.env,HOME:home,STASHDOCK_DATA_DIR:join(root,'library')};
delete env.STASHDOCK_NATIVE_HOST_REGISTRATION;
let context,child,server,reportTimer,recovery;
const ownedManifests=[],fixtureManifests=[];
let firefoxReport,completeReport;
const validate=report=>{
  assert.equal(report.httpCalls,0);assert.equal(report.base,'native:app.stashdock.'+(report.mode==='plugin'?'plugin':'desktop'));
  for(const value of report.saved){
    assert.equal(value.first.saved,true);assert.deepEqual(value.retried,value.first);
    assert.equal(value.duplicate.duplicate.id,value.first.id);assert.equal(value.replaced.replaced,true);
    assert.deepEqual(value.repeatedReplace,value.replaced);assert.deepEqual(value.tags,['Native acceptance',marker]);
  }
  return {mode:report.mode,provider:report.base,saves:report.saved.length,httpCalls:report.httpCalls};
};
try {
  await mkdir(home);await mkdir(join(profile,'NativeMessagingHosts'),{recursive:true});
  const library=createLocalLibrary({dataDir:env.STASHDOCK_DATA_DIR});
  try{library.importItems([{kind:'web',title:'Isolation marker',url:'https://example.org/'+suffix,tags:[marker]}]);}finally{library.close();}
  for(const provider of ['desktop','plugin']) {
    const target=join(root,provider==='desktop'?'Desktop 安装':'Plugin 安装','stashdock-browser');
    await mkdir(join(root,provider==='desktop'?'Desktop 安装':'Plugin 安装'));
    await cp(provider==='desktop'&&desktopHelperPath?resolve(desktopHelperPath):helper,target);
    const result=spawnSync(target,['--register',provider],{env,encoding:'utf8',timeout:5000});
    assert.equal(result.status,0,result.stderr);
    const vendor=browser==='chrome'?'Google/Chrome':browser==='edge'?'Microsoft Edge':'Mozilla';
    const manifest=JSON.parse(await readFile(join(home,'Library/Application Support',vendor,'NativeMessagingHosts',`app.stashdock.${provider}.json`),'utf8'));
    for(const mode of ['both','desktop','plugin']) {
      if(mode!=='both'&&mode!==provider)continue;
      const name=`app.stashdock.${provider}.${suffix}.${mode}`;
      const directory=browser==='firefox'?join(home,'Library/Application Support/Mozilla/NativeMessagingHosts'):join(profile,'NativeMessagingHosts');
      const localPath=join(directory,name+'.json');
      await writeFile(localPath,JSON.stringify({...manifest,name}));fixtureManifests.push(localPath);
      if(browser==='firefox') {
        // Firefox resolves the OS account's native-host directory even when an
        // owned child has an isolated HOME. Add unique QA names only; never
        // replace either product's registration. The helper still inherits the
        // isolated data location, which the nonce read below verifies first.
        const directory=join(homedir(),'Library/Application Support/Mozilla/NativeMessagingHosts');
        await mkdir(directory,{recursive:true});
        const path=join(directory,name+'.json'),bytes=JSON.stringify({...manifest,name});
        await writeFile(path,bytes,{flag:'wx'});ownedManifests.push({path,bytes});fixtureManifests.push(path);
      }
    }
  }
  await cp(resolve('output/extensions',browser),extension,{recursive:true});
  const manifest=JSON.parse(await readFile(join(extension,'manifest.json'),'utf8'));
  // The acceptance page calls unmodified shared clients. Do not run production
  // startup discovery against a daily provider from a synthetic test extension.
  recovery=await createNativeRecovery({root,home,suffix,desktop:join(root,'Desktop 安装/stashdock-browser'),manifests:fixtureManifests,env});
  if(browser==='firefox')firefoxReport=new Promise(resolve=>{completeReport=resolve;});
  const controlReports=[];
  server=createServer((request,response)=>{
    response.setHeader('Content-Type','application/json');
    response.setHeader('Access-Control-Allow-Origin','*');
    response.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers','Content-Type');
    if(request.method==='OPTIONS'){response.writeHead(204);response.end();return;}
    let body='';request.on('data',data=>{body+=data;});request.on('end',()=>{
      void(async()=>{
        if(request.method!=='POST')throw Error('Expected a fixture POST.');
        const value=JSON.parse(body);
        if(request.url==='/recovery/'+suffix){controlReports.push(value.phase);response.end(JSON.stringify(await recovery.mutate(value.phase)));}
        else if(browser==='firefox'&&request.url==='/report/'+suffix){completeReport({...value,controlReports});response.end('ok');}
        else throw Error('Unknown fixture endpoint.');
      })().catch(error=>{response.writeHead(400);response.end(JSON.stringify({error:String(error)}));});
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  manifest.host_permissions.push(`http://127.0.0.1:${server.address().port}/*`);
  if(browser==='firefox')manifest.background={scripts:['native-probe.js'],type:'module'};
  else manifest.background={service_worker:'acceptance-background.js'};
  await writeFile(join(extension,'manifest.json'),JSON.stringify(manifest));
  await writeFile(join(extension,'acceptance-background.js'),'// Disposable acceptance background.\n');
  await writeFile(join(extension,'native-probe.html'),'<!doctype html><script type="module" src="native-probe.js"></script>');
  await cp(resolve('tests/fixtures/native-browser-recovery.js'),join(extension,'native-browser-recovery.js'));
  await writeFile(join(extension,'native-probe.js'),`
    import {runNativeRecovery,verifyNativeRestart} from './native-browser-recovery.js';
    import {createNativeClient} from './native-client.js';
    import {createBrowserLibrary} from './library-client.js';
    import {checkSetup} from './setup-client.js';
    window.runNativeAcceptance=async(mode,suffix,browser,marker)=>{
      const extensionApi=globalThis.browser??globalThis.chrome;
      const api=extensionApi.runtime;
      const failures=[];
      const native=createNativeClient({get lastError(){return api.lastError;},connectNative:host=>{const port=api.connectNative(host+'.'+suffix+'.'+mode);port.onDisconnect.addListener(()=>{const error=api.lastError?.message||port.error?.message;if(error)failures.push({host,error});});return port;}});
      let httpCalls=0;const fetcher=()=>{httpCalls++;throw Error('HTTP forbidden');};
      const scope=await native.query('/tags');
      if(!scope?.value.tags?.includes(marker))throw Error('The native provider did not resolve the isolated acceptance library. No setup or save was attempted.');
      const setup=await checkSetup({native,fetcher,browser,version:api.getManifest().version,extensionId:api.id});
      if(!setup.connected)throw Error(JSON.stringify({...setup,failures}));
      const discovery=await native.query('/health');
      const providers=mode==='both'?['desktop','plugin']:[mode];
      const saved=[];
      for(const provider of providers){
        const base='native:app.stashdock.'+provider;
        const selected={at:native.at,query:async(path,body)=>({base,value:await native.at(base,path,body)})};
        const library=createBrowserLibrary({native:selected,fetcher,storage:extensionApi.storage.local});
        const item={id:'draft',title:mode+' '+provider,kind:'web',source:'Example',url:'https://example.org/native-acceptance/'+mode+'/'+provider,content:'Actual browser Native Messaging fixture 中文',excerpt:'',tags:['Native acceptance'],createdAt:new Date().toISOString(),favorite:false};
        const operationId=crypto.randomUUID();
        const first=await library.save(item,{operationId});
        const retried=await library.save(item,{operationId});
        const duplicate=await library.save({...item,title:'Unconfirmed change'},{operationId:crypto.randomUUID()});
        const replaceOperation=crypto.randomUUID();
        const replaced=await library.save({...item,content:'Confirmed replacement 中文'},{operationId:replaceOperation,replace:duplicate.duplicate});
        const repeatedReplace=await library.save({...item,content:'Confirmed replacement 中文'},{operationId:replaceOperation,replace:duplicate.duplicate});
        saved.push({provider,first,retried,duplicate,replaced,repeatedReplace,tags:await library.tags()});
      }
      return {mode,base:discovery.base,saved,httpCalls};
    };
    window.verifyRestart=operation=>verifyNativeRestart({createNativeClient,createBrowserLibrary,runtime:(globalThis.browser??globalThis.chrome).runtime,storage:(globalThis.browser??globalThis.chrome).storage.local,suffix:${JSON.stringify(suffix)},marker:${JSON.stringify(marker)},operation});
    window.runRecovery=()=>runNativeRecovery({createNativeClient,createBrowserLibrary,runtime:(globalThis.browser??globalThis.chrome).runtime,storage:(globalThis.browser??globalThis.chrome).storage.local,suffix:${JSON.stringify(suffix)},marker:${JSON.stringify(marker)},mutate:async phase=>{
      const response=await fetch(${JSON.stringify('http://127.0.0.1:'+server.address().port+'/recovery/'+suffix)},{method:'POST',body:JSON.stringify({phase})});
      const value=await response.json();if(!response.ok)throw Error(value.error);return value;
    }});
    // QA_FIREFOX_AUTORUN
    ${browser==='firefox'?`try {
      const results=[];
      for(const mode of ['desktop','plugin','both'])results.push(await window.runNativeAcceptance(mode,${JSON.stringify(suffix)},'firefox',${JSON.stringify(marker)}));
      const recovery=await window.runRecovery();
      await fetch(${JSON.stringify('http://127.0.0.1:'+server.address().port+'/report/'+suffix)},{method:'POST',body:JSON.stringify({id:browser.runtime.id,results,recovery})});
    } catch(error) { await fetch(${JSON.stringify('http://127.0.0.1:'+server.address().port+'/report/'+suffix)},{method:'POST',body:JSON.stringify({error:String(error),stack:error.stack})}); }`:''}
  `);
  let id,recoveryReport,restartReport;const reports=[];
  if(browser==='firefox') {
    let diagnostics='';
    const launchFirefox=()=>{
      child=spawn(process.execPath,[resolve(playwrightPath),'run','--no-config-discovery','--source-dir',extension,'--firefox','/Applications/Firefox.app/Contents/MacOS/firefox','--firefox-profile',profile,'--keep-profile-changes','--no-reload','--no-input','--arg=-headless'],{env,detached:true,stdio:['ignore','pipe','pipe']});
      child.stdout.on('data',data=>{diagnostics=(diagnostics+data).slice(-8000);});
      child.stderr.on('data',data=>{diagnostics=(diagnostics+data).slice(-8000);});
      child.on('error',error=>completeReport({error:String(error)}));
      child.on('exit',code=>completeReport({error:'Owned Firefox exited: '+code,diagnostics}));
      reportTimer=setTimeout(()=>completeReport({error:'Firefox acceptance timed out',diagnostics}),45000);
    };
    launchFirefox();
    const result=await firefoxReport;
    assert.equal(result.error,undefined,JSON.stringify(result));id=result.id;
    for(const report of result.results)reports.push(validate(report));recoveryReport=result.recovery;
    clearTimeout(reportTimer);
    const source=await readFile(join(extension,'native-probe.js'),'utf8');
    const boundary=source.indexOf('// QA_FIREFOX_AUTORUN');assert.ok(boundary>0);
    await writeFile(join(extension,'native-probe.js'),source.slice(0,boundary)+`
      try {
        const restart=await window.verifyRestart(${JSON.stringify(recoveryReport.operation)});
        await fetch(${JSON.stringify('http://127.0.0.1:'+server.address().port+'/report/'+suffix)},{method:'POST',body:JSON.stringify({restart})});
      } catch(error) { await fetch(${JSON.stringify('http://127.0.0.1:'+server.address().port+'/report/'+suffix)},{method:'POST',body:JSON.stringify({error:String(error)})}); }
    `);
    const exited=new Promise(resolve=>child.once('close',resolve));process.kill(-child.pid,'SIGTERM');await exited;
    firefoxReport=new Promise(resolve=>{completeReport=resolve;});diagnostics='';launchFirefox();
    const restarted=await firefoxReport;assert.equal(restarted.error,undefined,JSON.stringify(restarted));
    restartReport=restarted.restart;assert.deepEqual(restartReport.receipt,recoveryReport.saved);
  } else {
    const {chromium}=await import(pathToFileURL(resolve(playwrightPath)).href);
    const launch=()=>chromium.launchPersistentContext(profile,{
      executablePath:browser==='chrome'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],env,
    });
    context=await launch();
    const cdp=await context.browser().newBrowserCDPSession();
    ({id}=await cdp.send('Extensions.loadUnpacked',{path:extension}));
    const page=await context.newPage();
    await page.goto(`chrome-extension://${id}/native-probe.html`);
    await page.waitForFunction(()=>typeof window.runNativeAcceptance==='function');
    for(const mode of ['desktop','plugin','both']) {
      const report=await page.evaluate(({mode,suffix,browser,marker})=>window.runNativeAcceptance(mode,suffix,browser,marker),{mode,suffix,browser,marker});
      reports.push(validate(report));
    }
    recoveryReport=await page.evaluate(()=>window.runRecovery());
    await context.close();context=await launch();
    const restartedCdp=await context.browser().newBrowserCDPSession();
    const reloaded=await restartedCdp.send('Extensions.loadUnpacked',{path:extension});assert.equal(reloaded.id,id);
    const restartedPage=await context.newPage();await restartedPage.goto(`chrome-extension://${id}/native-probe.html`);
    await restartedPage.waitForFunction(()=>typeof window.verifyRestart==='function');
    restartReport=await restartedPage.evaluate(operation=>window.verifyRestart(operation),recoveryReport.operation);
    assert.deepEqual(restartReport.receipt,recoveryReport.saved);
  }
  assert.equal(restartReport.httpCalls,0);
  assert.equal(recoveryReport.reports.length,8);assert.equal(recoveryReport.httpCalls,0);
  assert.equal(recoveryReport.saved.saved,true);assert.deepEqual(recoveryReport.retry,recoveryReport.saved);
  const db=new DatabaseSync(recovery.database(),{readOnly:true});
  try {
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM stash_items').get().n,6);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM stash_items WHERE content='Confirmed replacement 中文'").get().n,4);
    assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');
  } finally {db.close();}
  console.log(JSON.stringify({browser,id,helper,desktopHelper:resolve(desktopHelperPath||helper),actualNativeMessaging:true,testOnlyHostNames:true,scopeAttestedBeforeSetupOrSave:true,disposableProfile:true,productionStartupDiscovery:false,reports,recovery:recoveryReport,restart:{browserProcessRestarted:true,developmentExtensionReloaded:true,...restartReport},rows:6}));
} finally {
  clearTimeout(reportTimer);
  await context?.close();
  if(child?.pid&&child.exitCode===null){
    const exited=new Promise(resolve=>child.once('close',resolve));
    try{process.kill(-child.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
    await exited;
  }
  if(server)await new Promise(resolve=>server.close(resolve));
  await recovery?.restore();
  for(const {path,bytes} of ownedManifests)if(await readFile(path,'utf8')===bytes)await rm(path);
  await rm(root,{recursive:true,force:true});
}
