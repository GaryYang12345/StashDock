async page => {
  const errors=[],reports=[];page.on('pageerror',error=>errors.push(error.message));
  for(const theme of ['light','dark'])for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:850});
    await page.goto('http://127.0.0.1:18749/tests/fixtures/save-sidebar.html?mode=duplicate');
    await page.locator('html').evaluate((node,value)=>{node.dataset.theme=value;},theme);
    await page.getByRole('button',{name:'Save page',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Replace saved page?',exact:true});await dialog.waitFor();
    if(await dialog.evaluate(node=>node.scrollWidth>node.clientWidth+1))throw Error('Dialog overflow');
    if(width===390)await page.screenshot({path:`output/playwright/save-confirm-${theme}.png`});
    await dialog.getByRole('button',{name:'Keep existing',exact:true}).click();await dialog.waitFor({state:'detached'});
    if(await page.evaluate(()=>window.sidebarFixture.replacements||0))throw Error('Cancel replaced a card');
    await page.getByRole('button',{name:'Save page',exact:true}).click();await dialog.waitFor();
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    if(await page.evaluate(()=>window.sidebarFixture.closes))throw Error('Dialog Escape closed the sidebar');
    await page.getByRole('button',{name:'Save page',exact:true}).click();await dialog.waitFor();
    await page.evaluate(()=>{window.sidebarFixture.mode='duplicate-error';});
    await dialog.getByRole('button',{name:'Replace page',exact:true}).click();
    await dialog.getByRole('alert').filter({hasText:'Fixture replacement failed'}).waitFor();
    await page.evaluate(()=>{window.sidebarFixture.mode='duplicate';});
    await dialog.getByRole('button',{name:'Replace page',exact:true}).click();
    await dialog.waitFor({state:'detached'});await page.getByRole('button',{name:'Saved',exact:true}).waitFor();
    if(await page.evaluate(()=>window.sidebarFixture.replacements)!==1)throw Error('Replacement did not commit exactly once');
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Page overflow');
    reports.push({theme,width});
  }
  await page.goto('http://127.0.0.1:18749/tests/fixtures/save-sidebar.html?mode=duplicate&long-title');
  await page.getByRole('button',{name:'Save page',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  await page.evaluate(()=>window.sidebarFixture.navigate());await dialog.waitFor({state:'detached'});
  if(await page.evaluate(()=>window.sidebarFixture.replacements||0))throw Error('Navigation committed a replacement');
  if(errors.length)throw Error(errors.join('\n'));
  return {reports,cancelEscapeErrorRetryNavigation:true,pageErrors:0,realLibraryWrites:0};
}
