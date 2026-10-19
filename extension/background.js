import { createBrowserLibrary } from './library-client.js';
import { captureActivePage } from './capture-client.js';
import { compressScreenshotInWorker } from './screenshot.js';
import { synchronizeActionBehavior } from './panel-behavior.js';
import { createCaptureSessions } from './capture-sessions.js';
import { checkProvider, createSetupConnection } from './setup-client.js';
import { extensionApi as chrome, createBrowserHost } from './browser-host.js';
const host = createBrowserHost(chrome);
const setup = createSetupConnection({ browser: host.name, version: chrome.runtime.getManifest().version, extensionId: chrome.runtime.id });
chrome.runtime.onInstalled.addListener(() => { void setup().catch(() => {}); });
chrome.runtime.onStartup.addListener(() => { void setup().catch(() => {}); });
void synchronizeActionBehavior(chrome).catch(error=>console.warn('StashDock action behavior could not be restored:',error));
const library=createBrowserLibrary({storage:chrome.storage.local,fetcher:(...args)=>fetch(...args),setup});
const key=windowId=>`stashdock-sidepanel:${windowId}`;
const sessions=createCaptureSessions(chrome,captureActivePage,compressScreenshotInWorker);
const clients=new Map();
function closeSession(windowId, permanent = true) {
  const client=clients.get(windowId);clients.delete(windowId);
  try{client?.port.postMessage(permanent ? {closed:true} : {reset:true});}catch{/* The browser may have already destroyed the sidebar. */}
  return sessions.close(windowId);
}
chrome.runtime.onConnect.addListener(port=>{
  const match=port.name.match(/^stashdock-sidebar:(\d+):([\w-]+)$/);
  if(!match||port.sender?.id!==chrome.runtime.id||port.sender.tab||port.sender.url!==chrome.runtime.getURL('sidepanel.html')){port.disconnect();return;}
  const windowId=Number(match[1]),client={id:match[2],port};clients.set(windowId,client);
  port.onDisconnect.addListener(()=>{if(clients.get(windowId)===client){clients.delete(windowId);void sessions.close(windowId);}});
  port.postMessage({ready:true});
});
// Both browser calls stay inside the actual gesture. Permissions are optional,
// persistent and user-approved; no debugger/Cookie access is requested.
chrome.action.onClicked.addListener(tab=>{
  if(!tab?.id)return;
  void setup().catch(() => {});
  const epoch=sessions.epoch(tab.windowId);
  const authorization=chrome.permissions.request({origins:['<all_urls>']}).catch(()=>false);
  const opening=host.open(tab.windowId);
  void Promise.all([opening,authorization]).then(()=>sessions.read(tab.windowId,true,epoch)).catch(error=>console.warn('StashDock could not open the save sidebar:',error));
});
chrome.windows.onRemoved.addListener(windowId=>{void closeSession(windowId);});
host.onClosed?.addListener(info=>{if(info.path==='sidepanel.html')void closeSession(info.windowId,false);});
chrome.tabs.onRemoved.addListener(tabId=>{
  void chrome.storage.session.get(null).then(entries=>chrome.storage.session.remove(Object.entries(entries).filter(([name,value])=>name.startsWith('stashdock-sidepanel:')&&value.expected?.tabId===tabId).map(([name])=>name)));
});
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(!message||typeof message.type!=='string')return false;
  if(message.type==='page-content-changed'&&sender.id===chrome.runtime.id&&sender.tab&&sender.documentId&&clients.has(sender.tab.windowId)){
    void sessions.refresh(sender.tab.windowId,message.token,sender.documentId).catch(()=>{});reply({received:true});return false;
  }
  if(sender.id!==chrome.runtime.id||sender.tab||sender.url!==chrome.runtime.getURL('sidepanel.html'))return;
  void(async()=>{
    if(!Number.isInteger(message.windowId))throw Error('This sidebar is not authorized.');
    const client=clients.get(message.windowId);
    if(client?.id!==message.clientId)throw Error('This sidebar was closed.');
    const entry=(await chrome.storage.session.get(key(message.windowId)))[key(message.windowId)];
    if(clients.get(message.windowId)!==client)throw Error('This sidebar was closed.');
    if(message.type==='provider-status')return checkProvider();
    if(message.type==='close-panel'){await closeSession(message.windowId);await host.close(message.windowId);return {closed:true};}
    if(message.type==='dismiss-panel'){await closeSession(message.windowId);return {closed:true};}
    if(message.type==='read-tags'){void library.recoverPending().catch(()=>{});return {tags:await library.tags()};}
    if(message.type==='read-current-page'||message.type==='retry-current-page')return sessions.read(message.windowId,message.type==='retry-current-page');
    if(!entry)throw Error('Click StashDock in the toolbar to read the current page.');
    const [tab]=await chrome.tabs.query({active:true,windowId:entry.expected.windowId});
    if(!tab||tab.id!==entry.expected.tabId||tab.url!==entry.expected.url||tab.status==='loading')throw Error('The page changed. Wait for the current page to finish reading.');
    if(message.token!==entry.token)throw Error('This preview expired. Wait for the current page to finish reading.');
    if(message.type!=='save-current-page')throw Error('Unsupported sidebar action.');
    const item=message.item,destination=new URL(item?.url);
    if(!['https:','http:'].includes(destination.protocol)||destination.username||destination.password||!['web','repo'].includes(item?.kind)||!item.title?.trim()||item.title.length>500||typeof item.content!=='string'||item.content.length>20000||!Array.isArray(item.tags)||item.tags.length>12||item.tags.some(tag=>typeof tag!=='string'||tag.length>48)||item.assetPath||item.originalPath||item.contextOverride||!entry.page||entry.loading)throw Error('This page contains invalid save data.');
    return library.save(item, {operationId:message.operationId,...(message.replace?{replace:message.replace}:{})});
  })().then(reply).catch(error=>reply({error:error.message}));return true;
});
