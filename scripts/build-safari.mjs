import { spawnSync } from 'node:child_process';
import { access, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { buildExtensions } from './build-browser-extensions.mjs';
import links from '../src-tauri/product-links.json' with { type: 'json' };
import { createHash } from 'node:crypto';
import { buildSafariCapture } from './build-safari-capture.mjs';

if (process.platform !== 'darwin') throw Error('Build the Safari app on macOS with Xcode.');
const root = resolve(import.meta.dirname, '..');
const output = join(root, 'output/safari');
const appName = 'StashDock Safari';
const project = join(output, appName, `${appName}.xcodeproj`);
const identifier = links.browserExtensions.safari.containingAppId;
const desktop = JSON.parse(await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
if (desktop.identifier !== identifier || !links.browserExtensions.safari.id.startsWith(`${identifier}.`)) {
  throw Error('Safari must be embedded in its configured Desktop containing app.');
}
function run(command, args, capture = false) {
  const result = spawnSync(command, args, { cwd: root, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) { if (capture) process.stderr.write(result.stderr || result.stdout); process.exit(result.status ?? 1); }
  return result.stdout;
}
// This entry point is also invoked directly by the Desktop builder.
run(process.execPath, ['scripts/sync-extension-ui.mjs']);
await buildExtensions(['safari']);
let exists = true;
try { await access(project); } catch { exists = false; }
if (!exists) {
  run('xcrun', ['safari-web-extension-packager', join(root, 'output/extensions/safari'), '--project-location', output,
    '--app-name', appName, '--bundle-identifier', identifier, '--swift', '--macos-only', '--no-open', '--no-prompt']);
  // Xcode 27.1's template derives the host ID from its display name, which can
  // conflict with the requested extension ID. Normalize only a newly generated
  // project, and add the extension's sandboxed localhost client entitlement.
  const file = join(project, 'project.pbxproj');
  const structure = JSON.parse(run('plutil', ['-convert', 'json', '-o', '-', file], true));
  let text = await readFile(file, 'utf8');
  for (const target of Object.values(structure.objects).filter(value => value.isa === 'PBXNativeTarget')) {
    const extension = target.productType === 'com.apple.product-type.app-extension';
    const wanted = extension ? links.browserExtensions.safari.id : identifier;
    for (const configId of structure.objects[target.buildConfigurationList].buildConfigurations) {
      const settings = structure.objects[configId].buildSettings;
      const start = text.indexOf(`\t\t${configId} /*`);
      const end = text.indexOf('\n\t\t};', start);
      if (start < 0 || end < start) throw Error('The Xcode project template changed.');
      let section = text.slice(start, end);
      for (const from of [settings.PRODUCT_BUNDLE_IDENTIFIER, JSON.stringify(settings.PRODUCT_BUNDLE_IDENTIFIER)]) {
        section = section.replace(`PRODUCT_BUNDLE_IDENTIFIER = ${from};`, `PRODUCT_BUNDLE_IDENTIFIER = ${JSON.stringify(wanted)};`);
      }
      if (extension && !settings.ENABLE_OUTGOING_NETWORK_CONNECTIONS) {
        section = section.replace('ENABLE_APP_SANDBOX = YES;', 'ENABLE_APP_SANDBOX = YES;\n\t\t\t\tENABLE_OUTGOING_NETWORK_CONNECTIONS = YES;');
      }
      text = text.slice(0, start) + section + text.slice(end);
    }
  }
  await writeFile(file, text);
  const info = join(output, appName, `${appName} Extension/Info.plist`);
  run('plutil', ['-insert', 'NSAppTransportSecurity', '-json', '{"NSAllowsLocalNetworking":true}', info]);
}
// Generated project resources point to the shared generated extension. Keep the
// user's Team/signing selection when rebuilding; never force-recreate a project.
await copyFile(join(root, 'safari/SafariWebExtensionHandler.swift'), join(output, appName, `${appName} Extension/SafariWebExtensionHandler.swift`));
await copyFile(join(root, 'safari/SafariCaptureProtocol.swift'), join(output, appName, `${appName} Extension/SafariCaptureProtocol.swift`));
// Add the protocol idempotently without changing the user's Team settings.
{
  const file=join(project,'project.pbxproj');
  const objects=JSON.parse(run('plutil',['-convert','json','-o','-',file],true)).objects;
  const handler=Object.entries(objects).find(([,v])=>v.isa==='PBXFileReference'&&v.path==='SafariWebExtensionHandler.swift')?.[0];
  const group=Object.entries(objects).find(([,v])=>v.isa==='PBXGroup'&&v.children?.includes(handler))?.[0];
  const phase=Object.entries(objects).find(([,v])=>v.isa==='PBXSourcesBuildPhase'&&v.files?.some(id=>objects[id]?.fileRef===handler))?.[0];
  if(!handler||!group||!phase)throw Error('The Safari source group changed.');
  const id=name=>createHash('sha256').update(name).digest('hex').slice(0,24).toUpperCase();
  const reference=Object.entries(objects).find(([,v])=>v.isa==='PBXFileReference'&&v.path==='SafariCaptureProtocol.swift')?.[0]||id('StashDock SafariCaptureProtocol reference');
  const build=Object.entries(objects).find(([,v])=>v.isa==='PBXBuildFile'&&v.fileRef===reference)?.[0]||id('StashDock SafariCaptureProtocol build');
  let text=await readFile(file,'utf8');
  if(!objects[reference])text=text.replace('/* Begin PBXFileReference section */',`/* Begin PBXFileReference section */\n\t\t${reference} /* SafariCaptureProtocol.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SafariCaptureProtocol.swift; sourceTree = "<group>"; };`);
  if(!objects[build])text=text.replace('/* Begin PBXBuildFile section */',`/* Begin PBXBuildFile section */\n\t\t${build} /* SafariCaptureProtocol.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${reference}; };`);
  for(const [owner,key,value] of [[group,'children',reference],[phase,'files',build]]) {
    if(objects[owner][key].includes(value))continue;
    // Match a definition, never an earlier reference in another object's list.
    const start=text.indexOf(`\n\t\t${owner} /*`),end=text.indexOf('\n\t\t};',start);
    if(start<0||end<start)throw Error('The Safari source list changed.');
    const section=text.slice(start,end),updated=section.replace(`${key} = (`,`${key} = (\n\t\t\t\t${value} /* SafariCaptureProtocol.swift */,`);
    if(updated===section)throw Error('The Safari source list was not updated.');
    text=text.slice(0,start)+updated+text.slice(end);
  }
  await writeFile(file,text);
  const verified=JSON.parse(run('plutil',['-convert','json','-o','-',file],true)).objects;
  if(!verified[group].children.includes(reference)||!verified[phase].files.includes(build))throw Error('The Safari protocol is not included in the extension target.');
}
console.log(`Safari project: ${project}`);
if (!process.argv.includes('--project-only')) {
  if(process.argv.includes('--helper-ready'))await access(join(root,'src-tauri/target/release/stashdock-browser'));
  else run('cargo',['build','--manifest-path','src-tauri/Cargo.toml','--locked','--release','--bin','stashdock-browser']);
  const version = JSON.parse(await readFile(join(root, 'extension/manifest.json'), 'utf8')).version;
  // Build only the extension. Tauri owns the containing Desktop application;
  // do not register or launch the packager's sample containing app.
  const args = ['-project', project, '-target', `${appName} Extension`, '-configuration', 'Debug',
    `CONFIGURATION_BUILD_DIR=${join(output, 'products')}`, `OBJROOT=${join(output, 'intermediates')}`,
    `MARKETING_VERSION=${version}`, `ARCHS=${process.arch === 'arm64' ? 'arm64' : 'x86_64'}`, 'MACOSX_DEPLOYMENT_TARGET=14.0', 'ENABLE_OUTGOING_NETWORK_CONNECTIONS=NO', 'build'];
  if (process.argv.includes('--unsigned')) args.push('CODE_SIGNING_ALLOWED=NO');
  run('xcodebuild', args);
  const extension=join(output,'products/StashDock Safari Extension.appex');
  const unsigned=process.argv.includes('--unsigned');
  const signed=spawnSync('codesign',['-dv','--verbose=2',extension],{encoding:'utf8'});
  const authority=signed.stderr?.match(/Authority=(.+)/)?.[1];
  const identities=!unsigned&&!process.env.APPLE_SIGNING_IDENTITY?run('security',['find-identity','-v','-p','codesigning'],true):'';
  const resolved=identities.split('\n').find(line=>authority&&line.includes(`"${authority}"`))?.match(/[A-F0-9]{40}/)?.[0];
  const identity=unsigned?'-':process.env.APPLE_SIGNING_IDENTITY||resolved;
  if(!identity)throw Error('Set APPLE_SIGNING_IDENTITY to sign the Safari capture service with the same team.');
  await buildSafariCapture({extension,identity,version:JSON.parse(await readFile(join(root,'package.json'),'utf8')).version,helper:join(root,'src-tauri/target/release/stashdock-browser')});
  run('codesign',['--force','--sign',identity,...(unsigned?[]:['--options','runtime','--timestamp=none']),'--entitlements','safari/Development.entitlements',extension]);
  run('codesign',['--verify','--strict','--deep',extension]);
}
