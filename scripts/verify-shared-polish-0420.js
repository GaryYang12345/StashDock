async page => {
  await page.goto('http://127.0.0.1:18747',{waitUntil:'domcontentloaded'});
  const ui=page.frameLocator('iframe');let checked=0;
  for(const theme of ['light','dark'])for(const width of [390,1063]) {
    await page.setViewportSize({width,height:900});
    await ui.locator('html').evaluate((el,theme)=>{el.dataset.theme=theme;el.dataset.accent=theme==='dark'?'blue':'neutral';},theme);
    await ui.getByRole('button',{name:'Import references',exact:true}).click();
    const dialog=ui.getByRole('dialog',{name:'Import references',exact:true});await dialog.waitFor();await page.waitForTimeout(600);
    const start=await dialog.boundingBox();await ui.getByRole('tab',{name:'Note',exact:true}).click();await page.waitForTimeout(600);
    const note=await dialog.boundingBox();if(Math.abs(start.height-note.height)<50)throw Error('MCP still fixed height');
    await ui.getByRole('tab',{name:'File',exact:true}).click();await page.waitForTimeout(600);
    if(await ui.getByText('Browse',{exact:true}).count())throw Error('MCP Browse remains');
    if(!await ui.getByRole('button',{name:'Save file',exact:true}).isDisabled())throw Error('MCP save missing');
    await ui.locator('input[type=file]').setInputFiles({name:'Test.txt',mimeType:'text/plain',buffer:Buffer.from('Test content')});await page.waitForTimeout(650);
    const g=await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,scroll:el.scrollHeight,client:el.clientHeight};});
    if(g.x<15||g.y<15||g.right>g.width-15||g.bottom>g.height-15)throw Error('MCP bounds '+JSON.stringify(g));
    await dialog.screenshot({path:`output/playwright/mcp-file-${theme}-${width}-0420.png`});
    await ui.getByRole('button',{name:'Close dialog',exact:true}).click();await dialog.waitFor({state:'hidden'});
    const cards=ui.locator('article');
    for(const i of [0,1,2,0]){await cards.nth(i).locator('button[data-card-menu]').click();await page.waitForTimeout(200);if(await ui.getByRole('menu').count()!==1||await ui.locator('article[data-menu-open]').count()!==1)throw Error('MCP competing menus');}
    await ui.getByRole('menuitem',{name:'Edit content',exact:true}).click();await ui.getByRole('dialog',{name:'Edit content',exact:true}).waitFor();
    if(await ui.getByRole('menu').count())throw Error('MCP stale action menu');
    await ui.getByRole('button',{name:'Close dialog',exact:true}).click();await ui.getByRole('dialog').waitFor({state:'hidden'});checked++;
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await ui.getByRole('button',{name:'Import references',exact:true}).click();const d=ui.getByRole('dialog',{name:'Import references',exact:true});await d.waitFor();
  for(const mode of ['Note','File','Link']){await ui.getByRole('tab',{name:mode,exact:true}).click();await page.waitForTimeout(60);if(await d.evaluate(el=>el.scrollWidth>el.clientWidth))throw Error('Reduced motion overflow');}
  await ui.getByRole('button',{name:'Close dialog',exact:true}).click();await d.waitFor({state:'hidden'});await page.emulateMedia({reducedMotion:'no-preference'});
  return {mcpThemeWidthChecks:checked,contentSized:true,saveConsistent:true,menuExclusive:true,reducedMotion:true};
}
