import { renderPopup } from './ui/popup.js';
import { normalizeFavicon } from './ui/siteIdentity.js';
import { canonicalReferenceUrl } from './ui/reference-url.js';
import { installTooltips } from './ui/tooltips.js';
import { motionTokens } from './ui/motion-tokens.js';
import { synchronizeActionBehavior } from './panel-behavior.js';
import { createSidebarClient } from './sidebar-client.js';
import { extensionApi as chrome } from './browser-host.js';
// Also migrate a previously auto-opened sidebar if its worker has not woken.
await synchronizeActionBehavior(chrome).catch(error=>console.warn('StashDock action behavior could not be restored:',error));
const disposeTooltips = installTooltips(document, { enter:motionTokens.duration.fast, exit:motionTokens.duration.instant, ease:motionTokens.ease.enter });
const theme = matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => { document.documentElement.dataset.theme = theme.matches ? 'dark' : 'light'; };
applyTheme(); theme.addEventListener('change',applyTheme);
const {id:windowId}=await chrome.windows.getCurrent();
const services=createSidebarClient(chrome,windowId,entry=>{
    const page=entry.page, url=new URL(canonicalReferenceUrl(page.url));
    const now=entry.createdAt||new Date().toISOString(),host=url.hostname.replace(/^www\./,'');
    return { id:entry.token,title:page.title||entry.title||host,kind:host==='github.com'?'repo':'web',source:page.platform||host,url:url.href,content:page.content,excerpt:'',tags:[],createdAt:now,preview:page.preview,
      origin:{platform:page.platform||host,importMethod:'browser_extension',importedAt:now,externalId:url.href,faviconUrl:normalizeFavicon(page.faviconUrl || entry.faviconUrl, url.href),author:page.author,publishedAt:page.publishedAt,captureMethod:page.captureMethod,truncated:page.truncated,previewKind:page.previewKind} };
},{live:()=>document.visibilityState!=='hidden'});
const unmount=renderPopup(document.querySelector('#root'),{...services,close:()=>{void services.close().catch(()=>window.close());}});
window.addEventListener('pagehide',()=>{
  unmount();
  services.dispose();
  disposeTooltips();
  theme.removeEventListener('change',applyTheme);
  document.removeEventListener('visibilitychange',services.wake);
},{once:true});
document.addEventListener('visibilitychange',services.wake);
