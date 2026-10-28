// Inspect only this extension's installation metadata, never cookies or page data.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { validBrowserExtensionId } from '../../../src/lib/browser-extension-identity.mjs';
export function firefoxAddonEnabled(value, id) {
  return value?.addons?.some(addon => addon.id === id && /^StashDock(?: Companion)?$/.test(addon.defaultLocale?.name || '') &&
    addon.active === true && !addon.userDisabled && !addon.appDisabled && !addon.pendingUninstall) || false;
}
function firefoxDetected(id, root) {
  try {
    let bytes = 0;
    return readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).slice(0, 32).some(entry => {
      try {
        const path = join(root, entry.name, 'extensions.json'), size = statSync(path).size;
        bytes += size;
        return size <= 16_000_000 && bytes <= 64_000_000 && firefoxAddonEnabled(JSON.parse(readFileSync(path, 'utf8')), id);
      } catch { return false; }
    });
  } catch { return false; }
}
export function extensionEnabled(value, id, name = value?.extensions?.settings?.[id]?.manifest?.name) {
  const entry = value?.extensions?.settings?.[id];
  // Chromium 141+ derives enablement from disable reasons, and unpacked
  // extensions keep their manifest on disk rather than in Preferences.
  return Boolean(entry && /^StashDock(?: Companion)?$/.test(name || '') &&
    (entry.state === undefined || entry.state === 1) &&
    (!entry.disable_reasons || Array.isArray(entry.disable_reasons) && entry.disable_reasons.length === 0));
}
export function browserExtensionDetected(browser, id, { root } = {}) {
  if (!validBrowserExtensionId(browser, id)) return false;
  // Safari enablement belongs to SafariServices in its containing Mac app.
  // Never probe Edge's profile as a fallback for this browser.
  if (browser === 'safari') return false;
  const home = homedir();
  if (browser === 'firefox') return firefoxDetected(id, root || (process.platform === 'win32'
    ? join(process.env.APPDATA || join(home, 'AppData/Roaming'), 'Mozilla/Firefox/Profiles')
    : process.platform === 'darwin' ? join(home, 'Library/Application Support/Firefox/Profiles') : join(home, '.mozilla/firefox')));
  root ||= process.platform === 'win32' ? join(process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'), browser === 'chrome' ? 'Google/Chrome/User Data' : 'Microsoft/Edge/User Data')
    : process.platform === 'darwin' ? join(home, 'Library/Application Support', browser === 'chrome' ? 'Google/Chrome' : 'Microsoft Edge')
      : join(process.env.XDG_CONFIG_HOME || join(home, '.config'), browser === 'chrome' ? 'google-chrome' : 'microsoft-edge');
  try {
    let bytes=0;
    return readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && /^(Default|Profile \d+)$/.test(entry.name)).slice(0, 32).some(entry => {
      const secure = join(root, entry.name, 'Secure Preferences');
      const path = existsSync(secure) ? secure : join(root, entry.name, 'Preferences');
      try {
        const size=statSync(path).size;bytes+=size;if(size>16_000_000||bytes>64_000_000)return false;
        const value=JSON.parse(readFileSync(path,'utf8')),extension=value.extensions?.settings?.[id];
        let name=extension?.manifest?.name;
        if(!name&&typeof extension?.path==='string') {
          const dir=isAbsolute(extension.path)?extension.path:extension.path.replaceAll('\\','/').startsWith(id+'/')?join(root,entry.name,'Extensions',extension.path):null;
          const manifest=dir&&join(dir,'manifest.json');
          if(manifest&&statSync(manifest).size<=1_000_000)name=JSON.parse(readFileSync(manifest,'utf8')).name;
        }
        return extensionEnabled(value,id,name);
      } catch { return false; }
    });
  } catch { return false; }
}
