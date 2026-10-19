async page => {
  const context=page.context(), worker=context.serviceWorkers().find(w=>w.url().endsWith('/background.js'));
  const browser=await context.browser().newBrowserCDPSession();
  await worker.evaluate(()=>{const original=fetch.bind(globalThis);globalThis.fetch=(url,...args)=>String(url).startsWith('http://127.0.0.1:1786')?Promise.resolve(new Response('{}',{status:503})):original(url,...args);});
  const cases=[
    ['https://capture.example.org/article','<main><h1>Generic article</h1><p>genericcapturebody An article with sufficient text to identify its actual body and save it.</p></main>','genericcapturebody'],
    ['https://x.com/mira/status/123456789','<article data-testid="tweet"><div data-testid="User-Name">Mira</div><a href="/mira/status/123456789"><time>Today</time></a><div data-testid="tweetText">xcapturebody Saved individual post.</div></article>','xcapturebody'],
    ['https://www.xiaohongshu.com/explore/123','<div class="note-content"><h1 id="detail-title">Note</h1><div id="detail-desc">xhscapturebody Individual note.</div></div>','xhscapturebody'],
    ['https://zhuanlan.zhihu.com/p/123','<h1 class="Post-Title">Article</h1><div class="Post-RichTextContainer">zhihucapturebody Individual article.</div>','zhihucapturebody'],
  ];
  const reports=[];
  for(const [url,body,token] of cases){
    await context.route(url,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Read only capture fixture</title>'+body}));
    await page.goto(url);
    for(let n=0;n<40;n++){
      if(await worker.evaluate(async url=>{const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});return tab?.url===url&&tab.status==='complete';},url))break;
      await page.waitForTimeout(50);
    }
    for(let attempt=0;attempt<2;attempt++){
      const previous=await worker.evaluate(async()=>Object.values(await chrome.storage.session.get(null)).map(e=>e.token));
      const tab=(await browser.send('Target.getTargets',{filter:[{type:'tab'}]})).targetInfos.find(t=>t.url===url);
      await browser.send('Extensions.triggerAction',{id:new URL(worker.url()).host,targetId:tab.targetId});
      let entry;
      for(let wait=0;wait<100;wait++){
        entry=await worker.evaluate(async url=>Object.values(await chrome.storage.session.get(null)).find(e=>e.expected?.url===url),url);
        if(entry&&!previous.includes(entry.token)&&!entry.loading)break;
        await page.waitForTimeout(50);
      }
      if(entry?.error||!entry?.page?.content.includes(token)||!entry.page.preview?.startsWith('data:image/jpeg;base64,'))throw Error('Capture failed: '+url+' '+entry?.error);
      reports.push({url,attempt,text:true,screenshot:true});
    }
  }
  return {syntheticDOM:true,realToolbarPermission:true,noUserLibraryWrites:true,captures:reports};
}
