async page => {
  const context=page.context(),browser=await context.browser().newBrowserCDPSession();
  const worker=context.serviceWorkers().find(w=>w.url().endsWith('/background.js'));
  await worker.evaluate(()=>{const original=fetch.bind(globalThis);globalThis.fetch=(url,...args)=>String(url).startsWith('http://127.0.0.1:1786')?Promise.resolve(new Response('{}',{status:503})):original(url,...args);});
  const urls=['https://one.example/article','https://two.example/article','https://three.example/article'];
  for(let i=0;i<urls.length;i++)await context.route(urls[i],route=>route.fulfill({contentType:'text/html',body:`<!doctype html><title>Article ${i}</title><main><h1>Article ${i}</h1><p>autobody${i} This is a readable article with enough real body text to capture.</p></main>`}));
  const postURL='https://x.com/mira/status/123456789';
  await context.route(postURL,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Sign in</title><form><input type="password" value="private-secret"/>Sign in</form>'}));
  await page.goto(urls[0]);
  const tab=(await browser.send('Target.getTargets',{filter:[{type:'tab'}]})).targetInfos.find(t=>t.url===page.url());
  await browser.send('Extensions.triggerAction',{id:new URL(worker.url()).host,targetId:tab.targetId});
  let target;
  for(let n=0;n<100&&!target;n++){target=(await browser.send('Target.getTargets')).targetInfos.find(t=>t.url.endsWith('/sidepanel.html'));if(!target)await page.waitForTimeout(50);}
  if(!target)throw Error('Sidebar did not open.');
  const {sessionId}=await browser.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});let id=0;
  const call=(method,params={})=>new Promise((resolve,reject)=>{const request=++id;const receive=e=>{if(e.sessionId!==sessionId)return;const m=JSON.parse(e.message);if(m.id!==request)return;browser.off('Target.receivedMessageFromTarget',receive);m.error?reject(Error(m.error.message)):resolve(m.result);};browser.on('Target.receivedMessageFromTarget',receive);browser.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:request,method,params})}).catch(reject);});
  const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text);return result.result.value;};
  const state=()=>evaluate('({url:document.querySelector("input")?.value,body:document.querySelector("textarea")?.value,error:document.querySelector("[role=alert]")?.innerText})');
  const waitBody=async token=>{for(let n=0;n<160;n++){const s=await state();if(s.body?.includes(token))return s;await page.waitForTimeout(50);}throw Error('Automatic refresh failed: '+JSON.stringify(await state()));};
  try {
    await waitBody('autobody0');
    await page.goto(urls[1]);await waitBody('autobody1');
    const other=await context.newPage();await other.goto(urls[2]);await waitBody('autobody2');
    await page.bringToFront();await waitBody('autobody1');
    for(const url of [urls[0],urls[2],urls[1]])await page.goto(url,{waitUntil:'commit'});
    await waitBody('autobody1');await page.waitForTimeout(1400);await waitBody('autobody1');
    await page.goto(postURL);
    for(let n=0;n<100;n++){if((await state()).error)break;await page.waitForTimeout(50);}
    if(!(await state()).error?.includes('Page could not be read'))throw Error('Login-only page did not show the normal read failure.');
    await page.evaluate(()=>{document.body.innerHTML='<article data-testid="tweet"><div data-testid="User-Name">Mira</div><a href="/mira/status/123456789"><time>Today</time></a><div data-testid="tweetText">retrypostbody Visible post after sign in.</div></article>';});
    const point=await evaluate('(()=>{const b=[...document.querySelectorAll("button")].find(n=>n.innerText==="Retry reading page");const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()');
    await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
    await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
    await waitBody('retrypostbody');
    await page.screenshot({path:'output/playwright/auto-page-final.png',scale:'css'});
    await worker.evaluate(async()=>{const {id}=await chrome.windows.getCurrent();await chrome.sidePanel.close({windowId:id});});
    await page.waitForTimeout(400);
    await page.goto(urls[0]);await page.waitForTimeout(1200);
    const sessions=await worker.evaluate(async()=>Object.keys(await chrome.storage.session.get(null)).filter(k=>k.startsWith('stashdock-sidepanel:')));
    if(sessions.length)throw Error('A closed sidebar kept a capture task/session alive.');
    return {singleToolbarClick:true,crossOriginNavigation:true,newTabAndSwitchBack:true,rapidSwitchLatestWins:true,loginErrorThenRetry:true,closedSidebarStops:true,syntheticDOM:true,fixtureConsentAlreadyGranted:true};
  } finally {await browser.send('Target.detachFromTarget',{sessionId}).catch(()=>{});}
}
