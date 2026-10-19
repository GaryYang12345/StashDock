async page => {
  const context=page.context(),browser=await context.browser().newBrowserCDPSession();
  let worker=context.serviceWorkers().find(w=>w.url().endsWith('/background.js'));
  const isolate=worker=>worker.evaluate(()=>{const original=fetch.bind(globalThis);globalThis.fetch=(url,...args)=>String(url).startsWith('http://127.0.0.1:1786')?Promise.resolve(new Response('{}',{status:503})):original(url,...args);});
  await isolate(worker);
  // Keep synthetic navigation within the toolbar's activeTab origin. This
  // validates a real persistent sidebar/worker without granting optional site
  // access or touching the user's Chrome profile or consent settings.
  const urls=['https://stable.example/one','https://stable.example/two','https://stable.example/three'];
  for(let i=0;i<3;i++)await context.route(urls[i],r=>r.fulfill({contentType:'text/html',body:`<!doctype html><title>Post ${i}</title><main><h1>Post ${i}</h1><p>stablebody${i} Visible article with enough genuine text to capture.</p><p>secondparagraph${i} All paragraphs remain part of this reference.</p></main>`}));
  const delayed='https://stable.example/late',dirty='https://stable.example/dirty';
  for(const url of [delayed,dirty])await context.route(url,r=>r.fulfill({contentType:'text/html',body:`<!doctype html><title>Delayed post</title><main><p id="post">initialpartial Some text is available before hydration finishes.</p></main><script>setTimeout(()=>document.querySelector('#post').innerText='fullhydratedbody This is the complete post after late hydration. Paragraph two. Paragraph three.',3500)</script>`}));
  await page.goto(urls[0]);
  const extensionId=new URL(worker.url()).host;
  const tab=(await browser.send('Target.getTargets',{filter:[{type:'tab'}]})).targetInfos.find(t=>t.url===page.url());
  await browser.send('Extensions.triggerAction',{id:extensionId,targetId:tab.targetId});
  let target;for(let n=0;n<100&&!target;n++){target=(await browser.send('Target.getTargets')).targetInfos.find(t=>t.url.endsWith('/sidepanel.html'));if(!target)await page.waitForTimeout(50);}
  if(!target)throw Error('Sidebar missing');
  const {sessionId}=await browser.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});let id=0;
  const call=(method,params={})=>new Promise((resolve,reject)=>{const request=++id;const receive=e=>{if(e.sessionId!==sessionId)return;const m=JSON.parse(e.message);if(m.id!==request)return;browser.off('Target.receivedMessageFromTarget',receive);m.error?reject(Error(m.error.message)):resolve(m.result);};browser.on('Target.receivedMessageFromTarget',receive);browser.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:request,method,params})}).catch(reject);});
  const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text);return result.result.value;};
  const state=()=>evaluate('({url:document.querySelector("input")?.value,title:document.querySelectorAll("input")[1]?.value,body:document.querySelector("textarea")?.value,error:document.querySelector("[role=alert]")?.innerText})');
  const wait=async predicate=>{for(let n=0;n<240;n++){const s=await state();if(predicate(s))return s;await page.waitForTimeout(50);}throw Error('Sidebar did not recover: '+JSON.stringify(await state()));};
  try {
    await wait(s=>s.body?.includes('stablebody0'));
    // A selection left over in the webpage must not shrink Save page content.
    await page.evaluate(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('p'));const s=getSelection();s.removeAllRanges();s.addRange(r);});
    await page.reload();await wait(s=>s.body?.includes('secondparagraph0'));
    for(let i=0;i<18;i++){await page.goto(urls[i%3]);await wait(s=>s.body?.includes('stablebody'+i%3));}
    await page.goto(delayed);await wait(s=>s.body?.includes('initialpartial'));await wait(s=>s.body?.includes('fullhydratedbody'));
    await page.goto(dirty);await wait(s=>s.body?.includes('initialpartial'));
    await evaluate('document.querySelectorAll("input")[1].focus();document.querySelectorAll("input")[1].select()');await call('Input.insertText',{text:'My edited title'});
    await evaluate('document.querySelector("textarea").focus();document.querySelector("textarea").select()');await call('Input.insertText',{text:'My supplemental content'});
    for(let n=0;n<240;n++){const entries=await worker.evaluate(async()=>Object.values(await chrome.storage.session.get(null)));if(entries.some(e=>e.page?.content?.includes('fullhydratedbody')))break;await page.waitForTimeout(50);}
    const edited=await state();if(edited.title!=='My edited title'||edited.body!=='My supplemental content')throw Error('Late body enrichment overwrote user edits.');
    const cdp=await context.newCDPSession(page),versions=[];
    cdp.on('ServiceWorker.workerVersionUpdated',event=>versions.push(...event.versions));await cdp.send('ServiceWorker.enable');await page.waitForTimeout(150);
    const version=[...versions].reverse().find(v=>v.scriptURL===worker.url()&&v.runningStatus==='running');if(!version)throw Error('Owned worker version missing');
    const marker=await worker.evaluate(()=>globalThis.__ownedWorkerMarker=crypto.randomUUID());
    await cdp.send('ServiceWorker.stopWorker',{versionId:version.versionId});
    let recovered=false;
    for(let n=0;n<100;n++){
      const candidate=context.serviceWorkers().find(w=>w.url().endsWith('/background.js'));
      if(candidate){try{if(await candidate.evaluate(()=>globalThis.__ownedWorkerMarker)!==marker){worker=candidate;recovered=true;break;}}catch{/* Worker context is being replaced. */}}
      await page.waitForTimeout(100);
    }
    if(!recovered)throw Error('Owned background context did not restart.');
    await isolate(worker);await cdp.detach();
    await page.goto(urls[2]);await wait(s=>s.body?.includes('stablebody2'));
    // Verify document observation is recreated after the real worker restart.
    await page.evaluate(()=>document.querySelector('main').append(document.createTextNode('afterrestartbody More content arrived.')));
    await wait(s=>s.body?.includes('afterrestartbody'));
    for(let i=0;i<12;i++){await page.goto(urls[i%3]);await wait(s=>s.body?.includes('stablebody'+i%3));}
    await page.screenshot({path:'output/playwright/sidebar-resilience.png',scale:'css'});
    const open=(await browser.send('Target.getTargets')).targetInfos.find(t=>t.targetId===target.targetId);
    if(!open)throw Error('Sidebar was replaced/reopened during recovery.');
    return {sameSidebarTarget:true,navigations:30,lateHydrationCompletes:true,userEditsPreserved:true,actualWorkerStopAndRecovery:true,observerRecoversAfterRestart:true,noToolbarReclick:true,syntheticPages:true};
  }finally{await browser.send('Target.detachFromTarget',{sessionId}).catch(()=>{});}
}
