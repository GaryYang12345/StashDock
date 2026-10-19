async page => {
 const context=page.context(),worker=context.serviceWorkers().find(w=>w.url().endsWith('/background.js'));
 if(!worker)throw Error('The owned extension worker is missing.');
 await worker.evaluate(()=>{const original=globalThis.fetch.bind(globalThis);globalThis.fetch=(url,...args)=>String(url).startsWith('http://127.0.0.1:1786')?Promise.resolve(new Response('{}',{status:503})):original(url,...args);});
 await context.route('https://capture.example.org/article',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Capture diagnostic</title><main><h1>Current page</h1><p>A readable diagnostic article. capturefixtureuniquetoken This is visible text that the user has explicitly selected to save.</p></main>'}));
 await page.goto('https://capture.example.org/article');
 const cdp=await context.browser().newBrowserCDPSession();
 const tab=(await cdp.send('Target.getTargets',{filter:[{type:'tab'}]})).targetInfos.find(t=>t.url===page.url());
 await cdp.send('Extensions.triggerAction',{id:new URL(worker.url()).host,targetId:tab.targetId});
 await page.waitForTimeout(1500);
 const state=await worker.evaluate(async()=>{
  const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
  const entry=(await chrome.storage.session.get(null));
  let result;
  try{await chrome.scripting.executeScript({target:{tabId:tab.id},files:['ui/page-capture.js']});result=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>globalThis.StashDockPageCapture.captureCurrentDocument()});}catch(e){result={error:e.message};}
  return {tab:{id:tab.id,url:tab.url},entries:Object.values(entry).map(e=>({error:e.error,loading:e.loading,content:e.page?.content})),injection:result};
 });
 return state;
}
