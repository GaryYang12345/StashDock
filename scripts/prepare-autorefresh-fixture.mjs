// Owned test-only copy: required test host access models optional consent that
// has already been granted. Never edits Chrome's profile or grants user access.
import {cpSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const root='D:/StashDock/output/playwright/extension-autorefresh-fixture';
mkdirSync(root,{recursive:true});cpSync('D:/StashDock/extension',root,{recursive:true});
const manifest=JSON.parse(readFileSync(root+'/manifest.json','utf8'));
manifest.host_permissions=[...manifest.host_permissions,...manifest.optional_host_permissions];
writeFileSync(root+'/manifest.json',JSON.stringify(manifest,null,2));
const config={browser:{browserName:'chromium',launchOptions:{executablePath:'C:/Users/86137/AppData/Local/ms-playwright/chromium-1247/chrome-win64/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging','--disable-extensions-except='+root,'--load-extension='+root]},contextOptions:{viewport:{width:1280,height:850}}}};
writeFileSync('D:/StashDock/output/playwright/autorefresh.config.json',JSON.stringify(config,null,2));
console.log('Prepared consent-granted fixture; production permissions remain optional.');
