async page => {
  await page.goto('http://127.0.0.1:5173/tests/fixtures/desktop-import.html',{waitUntil:'domcontentloaded'});
  await page.setViewportSize({width:1063,height:684});
  await page.getByRole('button',{name:'Open import fixture',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Import references',exact:true});
  await dialog.waitFor(); await page.waitForTimeout(700);
  const sizes={}, transitions=[];
  for(const mode of ['Link','Note','File','Link','File','Note']) {
    const before=await dialog.boundingBox(); await page.getByRole('tab',{name:mode,exact:true}).click();
    const frames=[]; for(let i=0;i<16;i++){frames.push(await dialog.boundingBox());await page.waitForTimeout(25);}
    await page.waitForTimeout(200);const final=await dialog.boundingBox();sizes[mode]=final.height;
    const min=Math.min(before.height,final.height),max=Math.max(before.height,final.height);
    if(frames.some(x=>x.height<min-2||x.height>max+2||Math.abs(x.y+x.height/2-342)>2))throw Error('Height overshoot or uncoordinated center '+JSON.stringify({before,frames,final}));
    if(Math.abs(final.height-before.height)>30 && !frames.some(x=>Math.abs(x.height-before.height)>2&&Math.abs(x.height-final.height)>2))throw Error('Height jumped without interpolation');
    transitions.push({mode,before:before.height,after:final.height});
  }
  if(Math.max(...Object.values(sizes))-Math.min(...Object.values(sizes))<60)throw Error('Import remains fixed height '+JSON.stringify(sizes));
  await page.getByRole('tab',{name:'File',exact:true}).click();
  if(await page.getByText('Browse',{exact:true}).count())throw Error('Redundant Browse remains');
  if(!await page.getByRole('button',{name:'Save file',exact:true}).isDisabled())throw Error('Initial file save missing/active');
  await page.locator('input[type=file]').setInputFiles({name:'Fixture.txt',mimeType:'text/plain',buffer:Buffer.from('File content')});
  await page.waitForTimeout(800);await page.getByRole('button',{name:'Save file',exact:true}).waitFor();
  await dialog.screenshot({path:'output/playwright/content-sized-file-0420.png'});
  await page.getByRole('button',{name:'Save file',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await page.goto('http://127.0.0.1:5173/tests/fixtures/modal-layout.html',{waitUntil:'domcontentloaded'});
  for(const name of ['First','Second','Third','First']) {
    await page.getByRole('button',{name:`Edit ${name}`,exact:true}).click();
    await page.waitForTimeout(100);
    if(await page.locator('[role="menu"][data-state="open"]').count()!==1)throw Error('Competing menus '+name);
    if(await page.locator('article[data-menu-open]').count()!==1)throw Error('Stale card hover');
  }
  await page.getByRole('menuitem',{name:'Edit card',exact:true}).click();await page.getByRole('dialog').waitFor();
  if(await page.locator('[role="menu"][data-state="open"]').count())throw Error('Menu remains after action');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  const button=page.getByRole('button',{name:'Minimize to folder',exact:true});
  const idle=await button.evaluate(el=>getComputedStyle(el).backgroundColor);await button.hover();
  await page.waitForTimeout(250);const hover=await button.evaluate(el=>getComputedStyle(el).backgroundColor);
  if(idle===hover)throw Error('Window hover invisible');
  if(await page.locator('[data-tooltip*="for AI"]').count())throw Error('Redundant copy tooltip');
  return {sizes,transitions,oneMenu:true,fileSaveCloses:true,windowHover:{idle,hover}};
}
