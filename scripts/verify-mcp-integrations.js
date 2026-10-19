async page => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:439,height:1000}); await page.goto('http://127.0.0.1:18747/?locale=en-US');
  const app=page.frameLocator('iframe');
  await app.getByRole('button',{name:'Settings',exact:true}).click();
  await app.getByRole('heading',{name:'Browser extensions',exact:true}).waitFor();
  await app.getByRole('heading',{name:'Desktop app',exact:true}).waitFor();
  if(await app.getByRole('heading',{name:'AI plugins',exact:true}).count()) throw Error('Competing platforms advertised inside Codex');
  if(await app.locator('[data-integration-row="codex"], [data-integration-row="claude"]').count()) throw Error('AI host contains competitor setup rows');
  for (const [section, copy] of [['Browser extensions', 'Save pages while you browse.'], ['Desktop app', 'Browse and manage your references visually in a standalone desktop app. Bring them into any AI app.']]) {
    const help = app.getByRole('button', { name: `About ${section}`, exact: true });
    await help.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0);
    await help.hover();
    await app.getByRole('tooltip').filter({ hasText: copy }).waitFor();
    if (await help.evaluate(el => getComputedStyle(el).cursor) !== 'pointer') throw Error('MCP still shows system help cursor');
    if (await app.getByRole('tooltip').innerText() !== copy) throw Error('MCP purpose copy differs');
    if (await app.getByRole('tooltip').evaluate(el => getComputedStyle(el).backgroundColor) !== 'rgb(13, 13, 13)') throw Error('MCP help does not use the shared black tooltip');
    await page.screenshot({ path: `output/playwright/mcp-settings-help-${section.replaceAll(' ', '-').toLowerCase()}.png` });
    await page.keyboard.press('Escape');
  }
  for(const id of ['chrome','edge','firefox','safari','desktop']) {
    const row=app.locator(`[data-integration-row="${id}"]`); await row.scrollIntoViewIfNeeded();
    if(!await row.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0))throw Error('Platform icon failed: '+id);
  }
  for (const [id, name, title] of [['desktop', 'StashDock Desktop', 'Use StashDock Desktop'], ['chrome', 'Chrome', 'Set up Chrome']]) {
    const row = app.locator(`[data-integration-row="${id}"]`);
    if(id==='desktop')await row.getByText('Detected', { exact: true }).waitFor();
    else if(await row.getByText('Detected',{exact:true}).count())throw Error('A fixture handshake was mistaken for an installed browser extension');
    const trigger = row.getByRole('button', { name: id==='desktop'?`View guide for ${name}`:`Set up ${name}`, exact: true });
    await trigger.click();
    const dialog = app.getByRole('dialog', { name: title, exact: true });
    await dialog.waitFor();
    if (await dialog.locator('ol').evaluate(el => getComputedStyle(el).listStyleType) !== 'decimal') throw Error('MCP guide step numbers differ');
    await page.waitForFunction(() => {
      const el = document.querySelector('iframe').contentDocument.querySelector('[role="dialog"]');
      return el && Number(getComputedStyle(el).opacity) > .999;
    });
    if (await dialog.getByRole('listitem').count() !== 3 || await dialog.getByRole('button', { name: 'Open installation page' }).count()) throw Error('Usage guide is missing steps or offers installation');
    if(id==='desktop')await dialog.getByText('Browse your library and use references as context in conversations.',{exact:true}).waitFor();
    const close=dialog.getByRole('button',{name:'Close dialog',exact:true});
    if(await close.evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(r.width-r.height)>.5||getComputedStyle(el).borderRadius!=='50%';}))throw Error('MCP close button is not circular');
    const opening=page.waitForRequest(request=>request.url().endsWith('/tool')&&request.postDataJSON()?.name==='open_stashdock_integration');
    await dialog.getByRole('button',{name:`Open ${name}`,exact:true}).click();
    if((await opening).postDataJSON().arguments.id!==id)throw Error('App button requested the wrong integration');
    await page.screenshot({ path: `output/playwright/mcp-guide-${id}.png` });
    await page.keyboard.press('Escape'); await dialog.waitFor({ state:'hidden' });
    if (!await trigger.evaluate(el => el === document.activeElement)) throw Error('MCP guide did not return focus');
  }
  for(const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:1000});
    await app.locator('[data-integration-section="Browser extensions"]').scrollIntoViewIfNeeded();
    if(await app.locator('[data-settings-view]').evaluate(el=>el.scrollWidth>el.clientWidth))throw Error('MCP overflow '+width);
    if(await app.locator('[data-integration-row]').evaluateAll(rows=>rows.some(row=>row.scrollWidth>row.clientWidth)))throw Error('MCP integration row overflow '+width);
    for(const id of ['desktop']){
      const row=app.locator(`[data-integration-row="${id}"]`);const status=await row.locator('[data-detected]').boundingBox(),button=await row.getByRole('button').boundingBox();
      if(status.x+status.width>button.x||Math.abs(status.y+status.height/2-button.y-button.height/2)>1)throw Error('MCP status is not to the left of its button');
    }
    await page.screenshot({path:`output/playwright/integrations-codex-${width}.png`});
  }
  if(errors.length)throw Error(errors.join('\n'));
  console.log('Packaged MCP: browser/desktop sections, no competitor rows, all brand images, guide/Escape and five widths passed.');
}
