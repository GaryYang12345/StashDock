async page => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const theme of ['light','dark']) {
    await page.goto(`http://127.0.0.1:18749/tests/fixtures/reference-visuals.html?theme=${theme}`);
    await page.locator('[data-reference-id="file"]').waitFor();
    for(const width of [390,768,1024,1440]) {
      await page.setViewportSize({width,height:1000});
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Gallery overflow '+width);
      const covers=await page.locator('[data-reference-id] [data-visual]').evaluateAll(elements=>elements.filter(el=>el.querySelector('svg')).map(el=>({type:el.dataset.visual,height:el.getBoundingClientRect().height,background:getComputedStyle(el).backgroundColor})));
      if(new Set(covers.map(x=>x.type)).size!==16||covers.some(x=>x.height<80))throw Error('Missing/empty cover '+JSON.stringify(covers));
      const rects=await page.locator('button[data-icon-only]').evaluateAll(buttons=>buttons.filter(el=>el.getBoundingClientRect().width).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{w:r.width,h:r.height,radius:s.borderRadius}}));
      if(rects.some(r=>Math.abs(r.w-r.h)>.5||r.radius!=='50%'))throw Error('Oval icon button '+JSON.stringify(rects));
      await page.screenshot({path:`output/playwright/reference-covers-${theme}-${width}.png`,fullPage:true});
    }
  }
  await page.setViewportSize({width:1024,height:900});
  await page.goto('http://127.0.0.1:18749/tests/fixtures/settings.html');
  await page.evaluate(()=>sessionStorage.removeItem('fixture-agent-disabled'));await page.reload();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  const row=page.locator('[data-integration-row="codex"]');
  await row.getByText('Detected',{exact:true}).waitFor();
  await row.getByRole('button',{name:'View guide for ChatGPT',exact:true}).click();
  const copy='Browse your library and use references as context in conversations.';
  await page.getByRole('dialog').getByText(copy,{exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await page.evaluate(()=>sessionStorage.setItem('fixture-agent-disabled','1'));
  await page.getByRole('button',{name:'Back to library',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await row.getByRole('button',{name:'Set up ChatGPT',exact:true}).waitFor();
  if(await row.getByText('Detected',{exact:true}).count())throw Error('Stale Detected survived re-entry');
  await row.getByRole('button',{name:'Set up ChatGPT',exact:true}).click();
  await page.getByRole('dialog').getByText(copy,{exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{sessionStorage.removeItem('fixture-agent-disabled');window.dispatchEvent(new Event('focus'));});
  await row.getByText('Detected',{exact:true}).waitFor();
  await row.getByRole('button',{name:'View guide for ChatGPT',exact:true}).click();
  const close=page.getByRole('button',{name:'Close dialog',exact:true});await close.hover();
  const shape=await close.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{w:r.width,h:r.height,radius:s.borderRadius}});
  if(Math.abs(shape.w-shape.h)>.5||shape.radius!=='50%')throw Error('Dialog Close is not circular');
  await page.screenshot({path:'output/playwright/guide-consistency.png'});
  if(errors.length)throw Error(errors.join('\n'));
  console.log('16 visual categories, two themes, four widths, circular icon controls, setup/guide copy and refreshed presence passed.');
}
