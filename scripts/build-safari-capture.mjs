import {spawnSync} from 'node:child_process';
import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
function run(command,args){const r=spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:60000});if(r.error)throw r.error;if(r.status!==0)throw Error(r.stderr||r.stdout);}

export async function buildSafariCapture({extension,identity,version,helper,fixture}) {
  const service=join(extension,'Contents/XPCServices/StashDockCapture.xpc');
  const contents=join(service,'Contents'),bin=join(contents,'MacOS');await mkdir(bin,{recursive:true});
  const info={CFBundleIdentifier:'app.stashdock.desktop.SafariCapture',CFBundleExecutable:'StashDockCapture',CFBundleName:'StashDock Capture',CFBundlePackageType:'XPC!',CFBundleVersion:version,CFBundleShortVersionString:version,XPCService:{ServiceType:'Application',RunLoopType:'NSRunLoop'}};
  if(fixture){info.StashDockQAHome=fixture.home;info.StashDockQALibrary=fixture.library;}
  // plutil produces the native plist; developer configuration never reaches JS.
  await writeFile(join(contents,'Info.plist'),JSON.stringify(info));
  run('plutil',['-convert','xml1',join(contents,'Info.plist')]);
  run('xcrun',['swiftc','-parse-as-library','-O','-target',`${process.arch==='arm64'?'arm64':'x86_64'}-apple-macos14.0`,...(fixture?['-D','STASHDOCK_QA']:[]),'safari/SafariCaptureProtocol.swift','safari/SafariCaptureService.swift','-o',join(bin,'StashDockCapture')]);
  await copyFile(helper,join(bin,'stashdock-browser'));
  const options=identity==='-'?[]:['--options','runtime','--timestamp=none'];
  for(const target of [join(bin,'stashdock-browser'),service])run('codesign',['--force','--sign',identity,...options,target]);
  run('codesign',['--verify','--strict','--deep',service]);
  // A production bundle must not accidentally contain a QA bootstrap.
  if(!fixture&&/StashDockQA/.test(await readFile(join(contents,'Info.plist'),'utf8')))throw Error('QA bootstrap in production capture service.');
  return service;
}
