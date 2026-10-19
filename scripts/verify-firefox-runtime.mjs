// Browser-native smoke in a throwaway profile. No broad website grants, user
// cookies, real provider writes or changes to the distributable package.
import { createServer } from 'node:http';
import { mkdtemp, cp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const browser = 'firefox', webExt = process.argv[2];
const binary = 'C:/Program Files/Mozilla Firefox/firefox.exe';
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
// A single test-only loopback origin, not <all_urls> and never a daily profile.
manifest.host_permissions.push(origin + '/*');
manifest.background = { scripts: ['runtime-probe.js'], type: 'module' };
await writeFile(join(source, 'manifest.json'), JSON.stringify(manifest));
await writeFile(join(source, 'runtime-probe.js'), `
const api=globalThis.browser??globalThis.chrome, reportFetch=globalThis.fetch;
// Startup/setup and any recovery are offline; no real local library is touched.
globalThis.fetch=(url,...args)=>String(url).startsWith(${JSON.stringify(origin)})||String(url).startsWith(api.runtime.getURL(''))||String(url).startsWith('data:') ? reportFetch(url,...args) : Promise.reject(Error('Runtime-test network isolation'));
try {
 await import('./background.js');
 const {createBrowserHost}=await import('./browser-host.js');
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
 await reportFetch(${JSON.stringify(origin + '/report')},{method:'POST',body:JSON.stringify({browser:host.name,backgroundStarted:true,documentIdentity,actualDOMExtraction,websitePermissionRequired,actualRasterEncoding:true,broadWebsiteAccess:false,realLibraryWrites:0})});
}catch(error){await reportFetch(${JSON.stringify(origin + '/report')},{method:'POST',body:JSON.stringify({error:String(error),stack:error.stack})});}
`);
let child, timeout;
try {
  if (!webExt) throw Error('Provide the installed web-ext JS entry path.');
  child = spawn(process.execPath, [webExt, 'run', '--source-dir', source, '--firefox', binary, '--firefox-profile', profile, '--keep-profile-changes', '--no-reload', '--no-input', '--arg=-headless'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', value => { log = (log + value).slice(-12000); }); child.stderr.on('data', value => { log = (log + value).slice(-12000); });
  child.on('error', error => complete({ error: String(error) }));
  const report = await Promise.race([result, new Promise(resolve => { timeout = setTimeout(() => resolve({ error: 'Runtime smoke timed out', log }), 45_000); })]);
  await mkdir('output', { recursive: true });
  await writeFile('output/' + browser + '-runtime.json', JSON.stringify({ ...report, isolatedProfile: profile }, null, 2));
  assert.equal(report.error, undefined, JSON.stringify(report));
  console.log(JSON.stringify(report));
} finally {
  clearTimeout(timeout); server.close(); child?.kill();
  // Only this test's exact profile owner, never a user's browser by image name.
  const script = "$ErrorActionPreference='Stop'; $profile=" + "'" + profile.replaceAll("'", "''") + "'; Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('firefox.exe','msedge.exe') -and $_.CommandLine -and $_.CommandLine.Contains($profile) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }";
  await new Promise(resolve => { const cleanup = spawn('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, stdio: 'ignore' }); cleanup.on('exit', resolve); cleanup.on('error', resolve); });
}
