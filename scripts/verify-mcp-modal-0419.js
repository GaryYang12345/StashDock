async page => {
  await page.goto('http://127.0.0.1:18747'); const ui=page.frameLocator('iframe'); let checked=0;
  const header=async()=>{const dialog=ui.getByRole('dialog').filter({has:ui.getByRole('button',{name:'Close dialog',exact:true})}); await dialog.waitFor(); await page.waitForTimeout(300);const g=await dialog.evaluate(el=>{const box=el.getBoundingClientRect(),h=el.querySelector('h2'),t=h.getBoundingClientRect(),c=el.querySelector('button[aria-label="Close dialog"]').getBoundingClientRect();return {left:t.left-box.left,top:t.top-box.top,center:Math.abs(t.top+parseFloat(getComputedStyle(h).lineHeight)/2-c.top-c.height/2),overflow:el.scrollWidth>el.clientWidth};}); const expected=await ui.locator('html').evaluate(()=>innerWidth<=560?17:25);if(Math.abs(g.left-expected)>1||Math.abs(g.top-expected)>1||g.center>1||g.overflow)throw Error('MCP dialog header: '+JSON.stringify(g));checked++;return dialog;};
  const close=async()=>{await ui.getByRole('button',{name:'Close dialog',exact:true}).click();await ui.getByRole('dialog').waitFor({state:'hidden'});await page.waitForTimeout(200);};
  for(const theme of ['light','dark']) for(const width of [439,1063]) {
    await page.setViewportSize({width,height:900});await ui.locator('html').evaluate((el,theme)=>{el.dataset.theme=theme;el.dataset.accent='neutral';},theme);
    await ui.getByRole('button',{name:'Import references',exact:true}).click();const dialog=await header();const start=await dialog.boundingBox();
    for(const mode of ['Note','File','Link']) {await ui.getByRole('tab',{name:mode,exact:true}).click();for(let i=0;i<6;i++){const rect=await dialog.boundingBox();if(Math.abs(rect.height-start.height)>1||Math.abs(rect.y-start.y)>1)throw Error('MCP dialog changes height while switching');await page.waitForTimeout(30);}}
    await close();
    const article=ui.locator('article').first();await article.waitFor();
    for(const action of ['Edit card','Edit content']) {await article.locator('button[data-card-menu]').click();await ui.getByRole('menuitem',{name:action,exact:true}).click();await header();await close();}
    await article.hover();await article.getByRole('button',{name:/^Delete /}).click();await header();await close();
    for(const action of ['Rename tag','Remove tag']) {await ui.getByRole('button',{name:'Tags',exact:true}).click();await ui.getByRole('button',{name:'Filter by Fixture',exact:true}).click({button:'right'});await ui.getByRole('menuitem',{name:action,exact:true}).click();await header();await close();}
  }
  await page.emulateMedia({reducedMotion:'reduce'});await ui.getByRole('button',{name:'Import references',exact:true}).click();const reduced=await header(),start=await reduced.boundingBox();for(const mode of ['Note','File','Link']) {await ui.getByRole('tab',{name:mode,exact:true}).click();const r=await reduced.boundingBox();if(Math.abs(r.height-start.height)>1)throw Error('Reduced-motion import changes height');}await close();await page.emulateMedia({reducedMotion:'no-preference'});
  return {mcpModalHeaderChecks:checked,allSixActiveDialogs:true,stableSidebarAndFullscreen:true,reducedMotion:true};
}
