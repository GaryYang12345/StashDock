// Development deployment only. Refresh registration without enabling extensions
// or changing Safari website permissions. Never register the generated build copy
// beside the installed copy: duplicate identities produce ambiguous system state.
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import productLinks from '../src-tauri/product-links.json' with { type: 'json' };
if (process.platform !== 'darwin' || !process.argv[2]) throw Error('Usage: node scripts/register-macos-development-app.mjs /absolute/StashDock.app');
const app = resolve(process.argv[2]);
if (!app.endsWith('.app')) throw Error('Choose the signed StashDock Desktop bundle.');
const extension = join(app,'Contents/PlugIns/StashDock Safari Extension.appex');
const bundleId = bundle => execFileSync('/usr/bin/plutil',['-extract','CFBundleIdentifier','raw','-o','-',join(bundle,'Contents/Info.plist')],{encoding:'utf8'}).trim();
if (bundleId(app) !== productLinks.browserExtensions.safari.containingAppId || bundleId(extension) !== productLinks.browserExtensions.safari.id) throw Error('This is not the StashDock Safari containing app.');
execFileSync('/usr/bin/codesign',['--verify','--strict','--deep',app]);
const staged = resolve(import.meta.dirname,'../src-tauri/target/release/bundle/macos/StashDock.app');
if (staged !== app) {
  const generatedExtension = join(staged,'Contents/PlugIns/StashDock Safari Extension.appex');
  if (existsSync(generatedExtension) && bundleId(generatedExtension) === productLinks.browserExtensions.safari.id) {
    const removed = spawnSync('/usr/bin/pluginkit', ['-r', generatedExtension], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } });
    // A build copy that was never registered is already in the desired state.
    // Preserve all other failures instead of masking a registration problem.
    if (removed.error) throw removed.error;
    if (removed.status !== 0 && !(removed.status === 1 && removed.stderr.trim() === `remove: no plugin at ${generatedExtension}`)) {
      throw Error(removed.stderr || 'Could not remove the generated Safari registration.');
    }
  }
}
execFileSync('/usr/bin/pluginkit',['-a',extension]);
console.log(JSON.stringify({registered:app,requestedEnablementChange:false,requestedWebsitePermissionChange:false}));
