// User-authorized diagnosis. --repair-action changes only StashDock's legacy
// automatic panel toggle. Never attach to ordinary website tabs,
// export cookies, run captures, reload extensions or close the user's browser.
const endpoint=process.argv[2],extensionId=process.argv[3];
const repair=process.argv[4]==='--repair-action';
if(!/^ws:\/\/127\.0\.0\.1:9222\/devtools\/browser\/[\da-f-]+$/.test(endpoint||'')||!/^\w{32}$/.test(extensionId||''))throw Error('Explicit local Chrome endpoint and extension ID required.');
const socket=new WebSocket(endpoint),pending=new Map();let next=0;
const timeout=setTimeout(()=>{console.error('Chrome did not authorize/respond within 25 seconds.');socket.close();process.exitCode=1;},25000);
socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const handler=pending.get(message.id);if(handler){pending.delete(message.id);message.error?handler.reject(Error(JSON.stringify(message.error))):handler.resolve(message.result);}}});
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
socket.addEventListener('open',async()=>{
  try{
    const version=await call('Browser.getVersion');console.log(JSON.stringify({browser:version.product}));
    const inventory=(await call('Target.getTargets')).targetInfos;
    console.log(JSON.stringify({targetTypes:inventory.reduce((counts,t)=>(counts[t.type]=(counts[t.type]||0)+1,counts),{})}));
    const targets=inventory.filter(t=>t.url.startsWith(`chrome-extension://${extensionId}/`));
    console.log(JSON.stringify({extensionTargets:targets.map(t=>({type:t.type,url:t.url,id:t.targetId}))}));
    for(const target of targets){
      if(!target.url.endsWith('/background.js')&&!target.url.endsWith('/sidepanel.html'))continue;
      const {sessionId}=await call('Target.attachToTarget',{targetId:target.targetId,flatten:true});
      try{
        if(repair&&target.url.endsWith('/sidepanel.html')){
          const fixed=await call('Runtime.evaluate',{expression:"(async()=>{await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:false});return chrome.sidePanel.getPanelBehavior();})()",returnByValue:true,awaitPromise:true},sessionId);
          if(fixed.exceptionDetails)throw Error('Panel behavior migration failed');
          console.log(JSON.stringify({repairedActionBehavior:fixed.result?.value}));
        }
        const common=`version:chrome.runtime.getManifest().version,websiteAccess:await chrome.permissions.contains({origins:['<all_urls>']}),behavior:await chrome.sidePanel.getPanelBehavior(),sessions:await Promise.all(Object.values(await chrome.storage.session.get(null)).map(async e=>{const [active]=await chrome.tabs.query({active:true,windowId:e.expected.windowId});const url=new URL(e.expected.url);return {page:url.origin+url.pathname,error:e.error,loading:e.loading,hasPage:Boolean(e.page),hasScreenshot:Boolean(e.page?.preview),activeTabMatches:active?.id===e.expected.tabId,activeURLMatches:active?.url===e.expected.url,activeStatus:active?.status};}))`;
        const expression=target.url.endsWith('/background.js')?`(async()=>({${common}}))()`:`(async()=>({${common},errors:[...document.querySelectorAll('[role="alert"]')].map(n=>n.innerText),hasFields:Boolean(document.querySelector('textarea'))}))()`;
        const evaluated=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
        console.log(JSON.stringify({target:target.type,state:evaluated.result?.value,exception:evaluated.exceptionDetails?.text}));
      }finally{await call('Target.detachFromTarget',{sessionId});}
    }
  }catch(error){console.error(error.message);process.exitCode=1;}
  finally{clearTimeout(timeout);socket.close();}
});
socket.addEventListener('error',()=>{clearTimeout(timeout);console.error('Chrome debugging connection failed.');process.exitCode=1;});
