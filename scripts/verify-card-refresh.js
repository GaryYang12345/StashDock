// Playwright CLI run-code, fresh browser contexts and synthetic library only.
async page => {
  const browser = page.context().browser();
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const app = await context.newPage();
  app.setDefaultTimeout(10000);
  const errors = [];
  app.on('pageerror', error => errors.push(error.message));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7i8AAAAASUVORK5CYII=','base64');
  await context.route('https://icons.fixture.test/**', route => route.fulfill({contentType:'image/png',body:png}));
  await context.route(/^https:\/\/example\.com\/(?:favicon\.(?:ico|svg|png)|apple-touch-icon\.png)$/, route => route.fulfill({status:404}));
  await context.addInitScript(() => {
    window.__copied = [];
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__copied.push(text)}});
    const preview = (dark, label) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="405"><rect width="720" height="405" fill="${dark?'#222426':'#f0eee9'}"/><rect x="32" y="26" width="656" height="30" rx="8" fill="${dark?'#393c3f':'#e1ded5'}"/><text x="54" y="130" fill="${dark?'#f7f7f7':'#343434'}" font-family="Arial" font-size="40">${label}</text><rect x="54" y="170" width="290" height="12" rx="6" fill="#a8a8a8"/><rect x="54" y="195" width="220" height="12" rx="6" fill="#a8a8a8"/><rect x="390" y="108" width="270" height="240" rx="24" fill="${dark?'#6c7d91':'#bbcabf'}"/><circle cx="523" cy="224" r="61" fill="${dark?'#c4ccd6':'#e2e8dc'}"/></svg>`);
    const items = [
      {title:'Designing calmer tools for everyday work',source:'Example',url:'https://example.com/design',preview:preview(false,'A quieter workspace'),origin:{faviconUrl:'https://icons.fixture.test/design.png'}},
      {title:'A long reference title with 中文内容 and enough words to verify consistent title height',source:'Example',url:'https://example.com/long',preview:preview(true,'Made for focused work')},
      {title:'A short title',source:'Example',url:'https://example.com/short',preview:preview(false,'Small details matter'),origin:{faviconUrl:'https://icons.fixture.test/short.png'}},
      {title:'Reference without a screenshot',source:'Example',url:'https://example.com/no-image'},
    ].map((item,index)=>({id:'card-'+index,kind:'web',excerpt:'Not rendered in the card',tags:['Hidden tag'],createdAt:'2026-10-01T00:00:00Z',...item}));
    localStorage.setItem('stashdock.items.v1',JSON.stringify(items));
  });
  await app.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded',timeout:30000});
  await app.bringToFront();
  await app.locator('article').first().waitFor();
  await app.evaluate(()=>document.fonts.ready);
  const first = app.locator('article').first();
  const select = first.getByRole('button',{name:/^Add .+ to context$/});
  const favorite = first.getByRole('button',{name:/favorites$/});
  const opacity = locator => locator.evaluate(el => getComputedStyle(el.parentElement).opacity);
  await app.mouse.move(0,0);
  if (await opacity(select) !== '0' || await opacity(favorite) !== '0') throw Error('Idle toolbar is not hidden');
  await first.hover();
  await app.waitForFunction(()=>getComputedStyle(document.querySelector('article button').parentElement).opacity==='1',null,{timeout:3000});
  const circles=await first.locator('button').evaluateAll(els=>els.filter(el=>/context$|favorites$|^Delete/.test(el.getAttribute('aria-label')||'')).map(el=>{const b=el.getBoundingClientRect();return [b.width,b.height];}));
  if(circles.length!==3||circles.some(([w,h])=>Math.abs(w-h)>0.1)) throw Error('Toolbar controls are not circular');
  await favorite.click();
  if(await favorite.getAttribute('aria-pressed')!=='true') throw Error('Favorite toggle failed');
  const star=await favorite.locator('svg').evaluate(el=>({fill:getComputedStyle(el).fill,color:getComputedStyle(el).color,token:getComputedStyle(document.documentElement).getPropertyValue('--favorite-star').trim()}));
  if(star.fill==='none'||star.token!=='#E8B931'||star.color!=='rgb(232, 185, 49)') throw Error('Favorite star lacks requested yellow state: '+JSON.stringify(star));
  await app.mouse.move(0,0);await app.waitForTimeout(220);
  if(await opacity(favorite)!=='0'||await opacity(select)!=='0') throw Error('Star click pins grid toolbar');
  await first.hover();
  await favorite.click();
  await app.mouse.move(0,0);
  await select.focus();
  await app.keyboard.press('Enter');
  await app.getByRole('heading',{name:'Context library',exact:true}).click();
  if (await opacity(first.getByRole('button',{name:/^Remove .+ from context$/})) !== '1') throw Error('Selected control vanished');
  await app.locator('article').nth(1).hover();
  await app.locator('article').nth(1).getByRole('button',{name:/^Add .+ to context$/}).click();
  const drag = await first.evaluate(el=>{const transfer=new DataTransfer();el.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));const result={plain:transfer.getData('text/plain'),markdown:transfer.getData('text/markdown'),urls:transfer.getData('text/uri-list')};el.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:transfer}));return result;});
  await app.waitForTimeout(200);
  if (drag.plain!==drag.markdown||(drag.plain.match(/^## /gm)||[]).length!==2||drag.urls.split('\r\n').length!==2) throw Error('Multi-selection drag payload changed');
  await first.getByRole('button',{name:/^Copy .+ for AI$/}).click();
  await first.getByRole('button',{name:/^Copy .+ for AI$/}).filter({hasText:'Copied'}).waitFor();
  if (!(await app.evaluate(()=>window.__copied.at(-1))).startsWith('# StashDock context')) throw Error('Copy payload invalid');
  const borders = await app.locator('article').evaluateAll(els=>els.map(el=>getComputedStyle(el).borderColor));
  if (new Set(borders).size!==1) throw Error('Selection changed the card border');
  const search=app.getByRole('searchbox',{name:'Search references'});
  await search.focus();
  if (await search.evaluate(el=>getComputedStyle(el.parentElement).borderColor===getComputedStyle(el).color)) throw Error('Search focus still uses the foreground border');
  await app.getByRole('heading',{name:'Context library',exact:true}).click();
  const widths=[];
  for(const width of [320,390,768,1024,1440]) {
    await app.setViewportSize({width,height:1000});
    const layout=await app.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,clipped:[...document.querySelectorAll('article button')].some(el=>{const b=el.getBoundingClientRect(),a=el.closest('article').getBoundingClientRect();return b.right>a.right+1||b.left<a.left-1;}),heights:[...document.querySelectorAll('article')].map(el=>el.getBoundingClientRect().height)}));
    if(layout.overflow||layout.clipped||Math.max(...layout.heights)-Math.min(...layout.heights)>1) throw Error('Card layout failed at '+width+': '+JSON.stringify(layout));
    widths.push(width);
    if(width===390) await app.screenshot({path:'output/playwright/card-refresh-390.png',animations:'disabled'});
  }
  await app.mouse.move(0,0);
  await app.screenshot({path:'output/playwright/card-refresh-light.png',animations:'disabled'});
  await first.hover();
  await app.screenshot({path:'output/playwright/card-refresh-hover.png',animations:'disabled'});
  const favicons=await app.locator('article').evaluateAll(els=>els.map(el=>({images:el.querySelectorAll('img[referrerpolicy="no-referrer"]').length,fallback:el.querySelector('span[aria-hidden="true"]')?.textContent})));
  if(favicons[0].images!==1||favicons[1].images!==0) throw Error('Favicon success/failure fallback failed');
  await app.getByRole('button',{name:'List',exact:true}).click();
  await first.hover();await favorite.click();
  await app.mouse.move(0,0);await app.waitForTimeout(220);
  if(await opacity(favorite)!=='0') throw Error('Star click pins list toolbar');
  for(const width of [390,768,1024,1440]) {await app.setViewportSize({width,height:1000});if(await app.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error('List overflow at '+width);}
  await app.screenshot({path:'output/playwright/card-refresh-list.png',animations:'disabled'});
  await app.getByRole('button',{name:'Grid',exact:true}).click();
  await app.evaluate(()=>{document.documentElement.dataset.theme='dark';document.documentElement.dataset.accent='blue';});
  await app.emulateMedia({reducedMotion:'reduce'});
  await app.screenshot({path:'output/playwright/card-refresh-dark.png',animations:'disabled'});
  if(errors.length) throw Error(errors.join('\n'));
  await context.close();
  const touchContext=await browser.newContext({viewport:{width:390,height:900},hasTouch:true,isMobile:true});
  const touch=await touchContext.newPage();
  await touch.addInitScript(()=>localStorage.setItem('stashdock.items.v1',JSON.stringify([{id:'touch',kind:'web',title:'Touch reference',source:'example.com',url:'https://example.com',tags:[],excerpt:'',createdAt:'2026-10-01'}])));
  await touch.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded',timeout:30000});
  await touch.locator('article').waitFor();
  const targets=await touch.locator('article button').evaluateAll(els=>els.map(el=>({height:el.getBoundingClientRect().height,opacity:getComputedStyle(el.parentElement).opacity})));
  if(targets.some(target=>target.height<44||target.opacity==='0')) throw Error('Touch actions inaccessible');
  await touchContext.close();
  return {widths,hover:true,keyboard:true,copy:true,multiDrag:true,quietBorders:true,favicons:true,touch:true,themes:['light-neutral','dark-blue'],errors};
}
