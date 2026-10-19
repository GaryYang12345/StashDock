async page => {
  // Owned Chrome profile only. The native side panel is a separate CDP target.
  const context=page.context(),browser=await context.browser().newBrowserCDPSession();
  const worker=context.serviceWorkers().find(value=>value.url().endsWith('/background.js'));
  await worker.evaluate(async()=>{
    const original=globalThis.fetch.bind(globalThis);
    globalThis.fetch=(url,...args)=>String(url).startsWith('http://127.0.0.1:1786')?Promise.resolve(new Response('{}',{status:503})):original(url,...args);
    await chrome.storage.local.set({'stashdock-library-v1':{items:[],imports:[],deletes:[],edits:[],knownTags:['Design','Research']}});
  });
  await context.route('https://capture.example.org/article',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Capture regression</title><main><h1>Readable article</h1><p>capturefixtureuniquetoken This is an article saved explicitly through the browser toolbar.</p><p>Its second paragraph remains available as editable reference content.</p></main>'}));
  await page.goto('https://capture.example.org/article');
  const tab=(await browser.send('Target.getTargets',{filter:[{type:'tab'}]})).targetInfos.find(value=>value.url===page.url());
  await browser.send('Extensions.triggerAction',{id:new URL(worker.url()).host,targetId:tab.targetId});
  let target;
  for(let attempt=0;attempt<100&&!target;attempt++){target=(await browser.send('Target.getTargets')).targetInfos.find(value=>value.url.endsWith('/sidepanel.html'));if(!target)await page.waitForTimeout(50);}
  if(!target)throw Error('Native sidebar target is missing.');
  const {sessionId}=await browser.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
  let id=0;
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const request=++id;
    const receive=event=>{if(event.sessionId!==sessionId)return;const message=JSON.parse(event.message);if(message.id!==request)return;browser.off('Target.receivedMessageFromTarget',receive);message.error?reject(Error(message.error.message)):resolve(message.result);};
    browser.on('Target.receivedMessageFromTarget',receive);
    browser.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:request,method,params})}).catch(reject);
  });
  const evaluate=async expression=>{
    const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw Error(result.exceptionDetails.text);
    return result.result.value;
  };
  async function click(selector) {
    const rect=JSON.parse(await evaluate(`JSON.stringify((()=>{const n=${selector};const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})())`));
    await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...rect});
    await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...rect});
  }
  const reports=[];
  try{
    for(let count=0;count<100;count++){if(await evaluate('Boolean(document.querySelector("textarea"))'))break;await page.waitForTimeout(50);}
    for(const [width,height,theme] of [[320,460,'light'],[390,704,'light'],[550,1400,'light'],[480,704,'dark'],[768,850,'dark']]){
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
      await page.waitForTimeout(350);
      const geometry=JSON.parse(await evaluate('JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,height:innerHeight,saveBottom:document.querySelector("button[type=submit]").getBoundingClientRect().bottom,scrollbar:getComputedStyle(document.querySelector("textarea")).scrollbarColor,content:document.querySelector("textarea").value})'));
      if(geometry.scroll>width||geometry.saveBottom>height||!geometry.content.includes('capturefixtureuniquetoken'))throw Error('Sidebar layout or capture failed.');
      delete geometry.content;
      const contentHeight=await evaluate('document.querySelector("textarea").getBoundingClientRect().height');
      if(height===1400&&contentHeight<650)throw Error('Tall sidebar wastes available content space.');
      if(await evaluate('Boolean(document.querySelector("button[aria-label=\\"Close sidebar\\"]"))'))throw Error('Chrome already provides Close.');
      reports.push({theme,contentHeight,...geometry});
    }
    if(await page.locator('#stashdock-save-panel').count())throw Error('Retired webpage overlay remains.');
    if(await worker.evaluate(async()=> (await chrome.storage.local.get('stashdock-library-v1'))['stashdock-library-v1'].imports.length))throw Error('The sidebar saved without confirmation.');
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:704,deviceScaleFactor:1,mobile:false});
    await evaluate('document.querySelectorAll("input")[1].focus();document.querySelectorAll("input")[1].select()');
    await call('Input.insertText',{text:'Reviewed sidebar title'});
    await evaluate('document.querySelector("textarea").focus();document.querySelector("textarea").select()');
    await call('Input.insertText',{text:'Reviewed supplemental context.'});
    await click('[...document.querySelectorAll("button")].find(n=>n.innerText==="Choose tags")');
    await page.waitForTimeout(250);
    await click('[...document.querySelectorAll("button")].find(n=>n.getAttribute("aria-label")==="Add tag Design")');
    await click('[...document.querySelectorAll("button")].find(n=>n.innerText==="Choose tags")');
    await page.waitForTimeout(300);
    await click('document.querySelector("button[type=submit]")');
    for(let count=0;count<100;count++){if(await evaluate('document.querySelector("button[type=submit]")?.innerText.includes("Saved")'))break;await page.waitForTimeout(50);}
    if(!(await browser.send('Target.getTargets')).targetInfos.some(value=>value.targetId===target.targetId))throw Error('Save closed the sidebar.');
    if(!await evaluate('document.querySelector("button[type=submit]").disabled && document.querySelector("button[type=submit]").innerText.includes("Saved")'))throw Error('Save confirmation missing.');
    const saved=await worker.evaluate(async()=> (await chrome.storage.local.get('stashdock-library-v1'))['stashdock-library-v1'].imports[0]);
    if(!saved||saved.title!=='Reviewed sidebar title'||saved.content!=='Reviewed supplemental context.'||!saved.tags.includes('Design')||!saved.preview.startsWith('data:image/jpeg;base64,'))throw Error('Edited values or screenshot were not durably saved: '+JSON.stringify(saved&&{title:saved.title,content:saved.content,tags:saved.tags,preview:Boolean(saved.preview)}));
    await click('document.querySelector("button[aria-label=\\"Refresh page\\"]")');
    await page.waitForTimeout(1800);
    if(await evaluate('document.querySelectorAll("input")[1].value')!=='Reviewed sidebar title'||await evaluate('document.querySelector("textarea").value')!=='Reviewed supplemental context.')throw Error('Refresh overwrote user edits.');
    await context.route('https://next-capture.example/article',r=>r.fulfill({contentType:'text/html',body:'<title>Next page</title><main><p>nextpagetoken This next article automatically fills the still-open sidebar after Save.</p></main>'}));
    await page.goto('https://next-capture.example/article');
    for(let count=0;count<100;count++){if(await evaluate('document.querySelector("textarea")?.value.includes("nextpagetoken")'))break;await page.waitForTimeout(50);}
    if(!await evaluate('document.querySelector("textarea")?.value.includes("nextpagetoken") && !document.querySelector("button[type=submit]").disabled'))throw Error('Sidebar did not continue after Save.');
    const screenshot=await call('Page.captureScreenshot',{format:'png'});
    const download=page.waitForEvent('download');
    await page.evaluate(data=>{const link=document.createElement('a');link.href='data:image/png;base64,'+data;link.download='sidebar-persistent.png';document.body.append(link);link.click();link.remove();},screenshot.data);
    await (await download).saveAs('output/playwright/sidebar-persistent.png');
    return {reports,nativeSidebar:true,noWebpageOverlay:true,noImplicitSave:true,durableOfflineSave:true,staysOpenAfterSave:true,refreshPreservesEdits:true,continuesAfterSave:true};
  }finally{
    await browser.send('Target.detachFromTarget',{sessionId}).catch(()=>{});
    await worker.evaluate(async()=>{const window=await chrome.windows.getCurrent();await chrome.sidePanel.close({windowId:window.id});}).catch(()=>{});
    await worker.evaluate(async()=>{await chrome.storage.local.clear();await chrome.storage.session.clear();});
  }
}
