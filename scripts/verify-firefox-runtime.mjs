// Browser-native smoke in a throwaway profile. No broad website grants, user
// cookies, real provider writes or changes to the distributable package.
import { createServer } from 'node:http';
import { mkdtemp, cp, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, isAbsolute, sep } from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';

const lifecycle = process.argv.includes('--lifecycle');
const positional = process.argv.slice(2).filter(value => value !== '--lifecycle');
const browser = 'firefox', webExt = positional[0];
const binary = positional[1] || (process.platform === 'darwin' ? '/Applications/Firefox.app/Contents/MacOS/firefox' : process.platform === 'win32' ? 'C:/Program Files/Mozilla Firefox/firefox.exe' : '/usr/bin/firefox');
if (!webExt) throw Error('Usage: node scripts/verify-firefox-runtime.mjs /path/to/web-ext.js [/path/to/firefox] [--lifecycle]');
await access(webExt); await access(binary);
const root = await mkdtemp(join(tmpdir(), 'stashdock-browser-runtime-test-'));
const source = join(root, 'extension'), profile = join(root, 'profile');
await cp(resolve('output/extensions', browser), source, { recursive: true }); await mkdir(profile);
let complete;
const result = new Promise(resolve => { complete = resolve; });
const server = createServer((request, response) => {
  if (request.url === '/report' && request.method === 'POST') {
    let body = ''; request.on('data', data => { body += data; });
    request.on('end', () => { complete(JSON.parse(body)); response.end('ok'); }); return;
  }
  response.setHeader('Content-Type', 'text/html');
  response.end('<!doctype html><html><head><title>StashDock browser runtime acceptance</title></head><body><main><h1>Original browser fixture</h1><p>This local article verifies document-targeted extraction in the actual browser engine.</p><p>Its second paragraph must be captured in full. No user data or live platform account is involved.</p></main></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
// A real profile or native grant would allow the native fetcher to bypass the
// HTTP isolation below. Keep native permission absent in this cold-start probe.
assert.ok(manifest.permissions.includes('nativeMessaging'));
// Explicit legacy/denial fixture: current distributable declares the permission
// at install; this isolated variant exercises the retained recovery adapter.
manifest.permissions=manifest.permissions.filter(value=>value!=='nativeMessaging');
manifest.optional_permissions=[...(manifest.optional_permissions||[]),'nativeMessaging'];
// A single test-only loopback origin, not <all_urls> and never a daily profile.
manifest.host_permissions.push(origin + '/*');
if (lifecycle) manifest.permissions.push('alarms'); // Test-only wake, no open extension view or keepalive port.
manifest.background = { scripts: ['runtime-probe.js'], type: 'module' };
await writeFile(join(source, 'manifest.json'), JSON.stringify(manifest));
await writeFile(join(source, 'runtime-probe.js'), `
import './background.js';
const api=globalThis.browser??globalThis.chrome, reportFetch=globalThis.fetch;
const epoch=crypto.randomUUID(), probeKey='stashdock-runtime-probe';
// Startup/setup and any recovery are offline; no real local library is touched.
globalThis.fetch=(url,...args)=>String(url).startsWith(${JSON.stringify(origin)})||String(url).startsWith(api.runtime.getURL(''))||String(url).startsWith('data:') ? reportFetch(url,...args) : Promise.reject(Error('Runtime-test network isolation'));
${lifecycle ? `api.alarms.onAlarm.addListener(alarm=>{
 if(alarm.name!==probeKey)return;
 void(async()=>{
  const saved=(await api.storage.session.get(probeKey))[probeKey];
  if(!saved)throw Error('Runtime probe lost session state');
  const report={...saved.report,backgroundStoppedAndWoken:saved.epoch!==epoch,firstEpoch:saved.epoch,secondEpoch:epoch};
  if(saved.epoch===epoch)report.error='The background did not suspend before the native alarm';
  if(await api.permissions.contains({permissions:['nativeMessaging']}))throw Error('Unexpected native messaging permission');
  await reportFetch(${JSON.stringify(origin + '/report')},{method:'POST',body:JSON.stringify(report)});
 })().catch(error=>reportFetch(${JSON.stringify(origin + '/report')},{method:'POST',body:JSON.stringify({error:String(error)})}));
});` : ''}
if(!(await api.storage.session.get(probeKey))[probeKey]) {
try {

 const {createBrowserHost}=await import('./browser-host.js');
 const {createFirefoxFetcher}=await import('./firefox-provider.js');
 const nativePermission=await api.permissions.contains({permissions:['nativeMessaging']});
 if(nativePermission)throw Error('The cold-start probe must not have native messaging access');
 const denied=await createFirefoxFetcher(api)('http://127.0.0.1:17863/v1/health');
 if(denied.status!==503||!(await denied.json()).error.includes('Firefox toolbar'))throw Error('Missing native permission needs an actionable recovery message');
 const host=createBrowserHost(api);
 await api.storage.session.set({runtimeAcceptance:true});
 if(!(await api.storage.session.get('runtimeAcceptance')).runtimeAcceptance)throw Error('Session storage failed');
 await api.storage.session.remove('runtimeAcceptance');
 const tab=await api.tabs.create({url:${JSON.stringify(origin)},active:true});
 for(let attempt=0;attempt<100;attempt++){if((await api.tabs.get(tab.id)).status==='complete')break;await new Promise(resolve=>setTimeout(resolve,100));}
 let actualDOMExtraction=false, documentIdentity=false, websitePermissionRequired=false;
 try {
 const loaded=await api.scripting.executeScript({target:{tabId:tab.id},world:'ISOLATED',files:['ui/page-capture.js']});
 const documentId=loaded.find(result=>result.frameId===0)?.documentId;
 if(!documentId)throw Error('The browser did not return document identity');
 const [{result:read}]=await api.scripting.executeScript({target:{tabId:tab.id,documentIds:[documentId]},world:'ISOLATED',func:()=>globalThis.StashDockPageCapture.captureCurrentDocument()});
 if(!read.page?.content.includes('second paragraph must be captured in full'))throw Error('Actual document extraction failed: '+JSON.stringify(read));
 let senderDocumentId;
 api.runtime.onMessage.addListener((message,sender,reply)=>{if(message.type!=='runtime-acceptance')return;senderDocumentId=sender.documentId;reply({received:true});return false;});
 await api.scripting.executeScript({target:{tabId:tab.id,documentIds:[documentId]},world:'ISOLATED',func:()=> (globalThis.browser??globalThis.chrome).runtime.sendMessage({type:'runtime-acceptance'})});
 if(senderDocumentId!==documentId)throw Error('Message document identity mismatch');
 actualDOMExtraction=true; documentIdentity=true;
 }catch(error){if(!/host permission/i.test(String(error)))throw error;websitePermissionRequired=true;}
 const {compressScreenshotInWorker}=await import('./screenshot.js');
 const raster=await compressScreenshotInWorker(api.runtime.getURL('icons/icon-128.png'),{width:128,contentWidth:128});
 if(!raster.startsWith('data:image/jpeg;base64,'))throw Error('Browser raster pipeline failed');
 const permission=await api.permissions.contains({origins:['<all_urls>']});
 if(permission)throw Error('Broad website access must stay ungranted');
 const report={browser:host.name,backgroundStarted:true,documentIdentity,actualDOMExtraction,websitePermissionRequired,actualRasterEncoding:true,broadWebsiteAccess:false,nativePermission:false,nativePermissionRecoveryHint:true,realLibraryWrites:0};
 ${lifecycle ? `await api.storage.session.set({[probeKey]:{epoch,report}}); await api.alarms.create(probeKey,{delayInMinutes:1});` : `await reportFetch(${JSON.stringify(origin + '/report')},{method:'POST',body:JSON.stringify(report)});`}
}catch(error){await reportFetch(${JSON.stringify(origin + '/report')},{method:'POST',body:JSON.stringify({error:String(error),stack:error.stack})});}
}
`);
let child, timeout, actualProfile;
let log = '', logTail = '';
const captureLog = bytes => {
  const value=bytes.toString().replace(/\x1b\[[0-9;]*m/g,'');
  log=(log+value).slice(-12000); logTail=(logTail+value).slice(-16000);
  const match=logTail.match(/Running Firefox with profile at ([^\r\n]+)/);
  if(match) {
    const candidate=resolve(match[1].trim());
    // Accept cleanup identity only from this owned launch and only under the
    // system temporary directory. --keep-profile-changes is deliberately absent.
    if(isAbsolute(candidate)&&candidate.startsWith(resolve(tmpdir())+sep)) actualProfile=candidate;
  }
};
try {
  child = spawn(process.execPath, [webExt, 'run', '--no-config-discovery', '--source-dir', source, '--firefox', binary, '--firefox-profile', profile, '--no-keep-profile-changes', '--verbose', '--no-reload', '--no-input', '--arg=-headless'], { windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data',captureLog); child.stderr.on('data',captureLog);
  child.on('error', error => complete({ error: String(error) }));
  child.on('exit', (code, signal) => complete({ error: 'The owned web-ext process exited before reporting', code, signal, log }));
  const report = await Promise.race([result, new Promise(resolve => { timeout = setTimeout(() => resolve({ error: 'Runtime smoke timed out', log }), lifecycle ? 100_000 : 45_000); })]);
  await mkdir('output', { recursive: true });
  await writeFile('output/' + browser + '-runtime.json', JSON.stringify({ ...report, platform:process.platform, binary, isolatedProfile: actualProfile || null, emptyProfileSeed:profile }, null, 2));
  assert.equal(report.error, undefined, JSON.stringify(report));
  assert.equal(report.browser, 'firefox');
  assert.equal(report.backgroundStarted, true);
  assert.equal(report.actualRasterEncoding, true);
  assert.equal(report.nativePermissionRecoveryHint, true);
  assert.equal(report.nativePermission, false);
  assert.equal(report.broadWebsiteAccess, false);
  assert.equal(report.realLibraryWrites, 0);
  if (lifecycle) assert.equal(report.backgroundStoppedAndWoken, true);
  console.log(JSON.stringify(report));
} finally {
  clearTimeout(timeout); server.close(); server.closeAllConnections();
  if (process.platform === 'win32') {
    // Only this launch's cloned temporary profile, never the user's profile.
    const cleanupProfile=actualProfile || profile;
    const script = "$ErrorActionPreference='Stop'; $profile=" + "'" + cleanupProfile.replaceAll("'", "''") + "'; Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'firefox.exe' -and $_.CommandLine -and $_.CommandLine.Contains($profile) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }";
    await new Promise(resolve => { const cleanup = spawn('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, stdio: 'ignore' }); const timer=setTimeout(()=>{cleanup.kill();resolve();},5000); cleanup.on('exit',()=>{clearTimeout(timer);resolve();}); cleanup.on('error',()=>{clearTimeout(timer);resolve();}); });
    child?.kill();
  } else if (child?.pid) {
    // Firefox may detach into its own process group on macOS. Identify only
    // this launch's exact cloned temporary profile, then retire that group.
    const ownedBrowsers = async () => {
      if (!actualProfile) return [];
      const {stdout}=await promisify(execFile)('ps',['-axo','pid=,pgid=,command='],{timeout:3000,maxBuffer:4*1024*1024});
      return stdout.split('\n').flatMap(line=>{
        const match=line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
        if(!match || !match[3].startsWith(binary+' '))return [];
        const profileArg=match[3].match(/(?:^|\s)-profile (.+?)(?=\s+-|$)/)?.[1];
        if(!profileArg || resolve(profileArg)!==actualProfile)return [];
        return [{pid:Number(match[1]),group:Number(match[2])}];
      });
    };
    const owned=await ownedBrowsers();
    const retire=(owner,signal)=>{try{process.kill(owner.group===owner.pid ? -owner.group : owner.pid,signal);}catch(error){if(error.code!=='ESRCH')throw error;}};
    for(const owner of owned)retire(owner,'SIGTERM');
    const signal = value => { try { process.kill(-child.pid,value); } catch(error) { if(error.code!=='ESRCH')throw error; } };
    signal('SIGTERM');
    await new Promise(resolve=>setTimeout(resolve,1000));
    for(const owner of await ownedBrowsers())retire(owner,'SIGKILL');
    signal('SIGKILL');
  }
}
