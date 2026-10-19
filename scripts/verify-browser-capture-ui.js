async page => {
  const reports=[],calls=[];
  page.on('request',request=>{if(request.url().endsWith('/tool'))calls.push(request.postDataJSON());});
  for(const host of ['desktop','codex'])for(const width of [390,768,1024,1440]){
    await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:width===768?'reduce':'no-preference'});
    const theme=width>=1024?'dark':'light';
    await page.goto(host==='desktop'?'http://127.0.0.1:5173/tests/fixtures/desktop-import.html':`http://127.0.0.1:18747/?theme=${theme}`,{waitUntil:'domcontentloaded'});
    const surface=host==='desktop'?page:page.frameLocator('iframe[title="StashDock MCP App"]');
    await surface.getByRole('button',{name:host==='desktop'?'Open import fixture':'Import references',exact:true}).click();
    const dialog=surface.getByRole('dialog');
    await dialog.evaluate((node,theme)=>{node.ownerDocument.documentElement.dataset.theme=theme;},theme);
    await dialog.getByRole('button',{name:'Import from',exact:true}).click();
    const menu=surface.getByRole('menu');
    if(await menu.getByRole('menuitem',{name:/WeChat|Weibo|Xiaohongshu|Zhihu/}).count())throw Error('Separate or retired platform choices remain.');
    const group=menu.getByRole('menuitem',{name:'Platforms',exact:true});
    await group.locator('img').first().waitFor({state:'visible'});
    await group.evaluate(node=>Promise.all([...node.querySelectorAll('img')].map(img=>img.decode())));
    const icons=await group.locator('img').evaluateAll(nodes=>nodes.map(node=>({width:parseFloat(getComputedStyle(node).width),height:parseFloat(getComputedStyle(node).height),loaded:node.naturalWidth>0})));
    if(icons.length!==3||icons.some(icon=>icon.width!==24||icon.height!==24||!icon.loaded))throw Error('Platform group geometry is incorrect.');
    if(await group.getByText(/\+\d+/).count())throw Error('Overflow shows a count instead of an ellipsis.');
    await group.click();
    await dialog.getByRole('heading',{name:'Platforms',exact:true}).waitFor({state:'visible'});
    for(const name of ['X','Instagram','Reddit','LinkedIn','Pinterest','Xiaohongshu','Zhihu']){
      const open=dialog.getByRole('button',{name:`Open ${name}`,exact:true});
      await open.scrollIntoViewIfNeeded();await open.click();
      await page.waitForTimeout(80);
    }
    await dialog.getByRole('button',{name:'Add platform',exact:true}).click();
    const child=surface.getByRole('dialog').filter({has:surface.getByRole('heading',{name:'Add platform',exact:true})});
    await child.getByRole('textbox',{name:'Website link',exact:true}).fill('javascript:alert(1)');
    await child.getByRole('button',{name:'Save platform',exact:true}).click();
    await child.getByText('Use an http:// or https:// website link without sign-in credentials.',{exact:true}).last().waitFor({state:'visible'});
    await child.getByRole('textbox',{name:'Website link',exact:true}).fill(`https://custom-${width}.example.org/account`);
    await child.getByRole('button',{name:'Save platform',exact:true}).click();
    await child.waitFor({state:'hidden'});
    const open=dialog.getByRole('button',{name:`Open custom-${width}.example.org`,exact:true});
    await open.scrollIntoViewIfNeeded();await open.click();await page.waitForTimeout(80);
    await dialog.getByRole('button',{name:'Back to Link',exact:true}).click();
    await dialog.getByRole('button',{name:'Import from',exact:true}).click();await surface.getByRole('menuitem',{name:'Platforms',exact:true}).click();
    await dialog.getByRole('button',{name:`Open custom-${width}.example.org`,exact:true}).waitFor({state:'visible'});
    // Inspect the settled surface, not an intentionally clipped spring frame.
    await page.waitForTimeout(600);
    const bounds=await dialog.boundingBox();
    if(!bounds||bounds.x<0||bounds.x+bounds.width>width+1||bounds.y<0||bounds.y+bounds.height>901)throw Error('Platform panel clips.');
    await page.screenshot({path:`output/playwright/platforms-${host}-${width}-${theme}.png`});
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    reports.push({host,width,theme,group:true,sevenPlatforms:true,customSaveReopen:true,invalidProtocolRejected:true});
  }
  if(!calls.some(call=>call.name==='save_stashdock_capture_platform'))throw Error('Codex custom platforms did not persist through the server.');
  return {reports,codexOpenCalls:calls.filter(call=>call.name==='open_stashdock_capture_site').length};
}
