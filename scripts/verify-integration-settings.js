async page => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.goto('http://127.0.0.1:18749/tests/fixtures/settings.html');
  await page.evaluate(() => sessionStorage.clear()); await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('heading', { name: 'Browser extensions', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'AI plugins', exact: true }).waitFor();
  for (const id of ['chrome','edge','firefox','safari','codex','claude']) {
    const row = page.locator(`[data-integration-row="${id}"]`);
    if (await row.locator('img').count() !== 1) throw Error('Missing platform icon: ' + id);
    await row.scrollIntoViewIfNeeded();
  }
  if (await page.getByText('Coming soon', { exact: true }).count() !== 4) throw Error('Planned platform states are incorrect');
  for (const theme of ['light','dark']) for (const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(theme => { document.documentElement.dataset.theme=theme; document.documentElement.dataset.accent=theme==='dark'?'blue':'neutral'; }, theme);
    await page.locator('[data-integration-section="Browser extensions"]').scrollIntoViewIfNeeded();
    if (await page.locator('[data-settings-view]').evaluate(el=>el.scrollWidth>el.clientWidth)) throw Error('Settings overflow: ' + width);
    if (await page.locator('[data-integration-row]').evaluateAll(rows=>rows.some(row=>row.scrollWidth>row.clientWidth))) throw Error('Platform row overflow: ' + width);
    const row=page.locator('[data-integration-row="codex"]');
    const status=await row.locator('[data-detected]').boundingBox(), action=await row.getByRole('button',{name:'View guide for ChatGPT',exact:true}).boundingBox();
    if(status.x+status.width>action.x || Math.abs(status.y+status.height/2-action.y-action.height/2)>1)throw Error('Detected must sit immediately left of the guide button');
    const peer=await page.locator('[data-integration-row="claude"]').boundingBox(), current=await row.boundingBox();
    if(Math.abs(peer.height-current.height)>1)throw Error('AI peer rows have different heights');
    await page.screenshot({ path: `output/playwright/integrations-desktop-${theme}-${width}.png` });
  }
  await page.getByRole('button', { name: 'Set up Chrome', exact: true }).click();
  await page.getByRole('dialog', { name: 'Set up Chrome', exact: true }).waitFor();
  if(!await page.getByRole('button',{name:'Copy GitHub link',exact:true}).isDisabled())throw Error('Missing GitHub URL is copyable');
  if (await page.getByRole('button', { name: 'Open installation page', exact: true }).count()) throw Error('Unconfigured download link was fabricated');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.goto('http://127.0.0.1:18749/tests/fixtures/save-sidebar.html?provider=1&mode=offline');
  await page.setViewportSize({ width: 439, height: 1000 });
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Keep this edited draft');
  if (!await page.getByRole('button', { name: 'Save page', exact: true }).isDisabled()) throw Error('Save enabled without local provider');
  if (await page.getByRole('button', { name: 'Settings', exact: true }).count()) throw Error('Browser settings were not removed');
  await page.screenshot({ path:'output/playwright/extension-missing-provider.png' });
  await page.evaluate(()=>{window.sidebarFixture.mode='';});
  await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await page.getByRole('alert').waitFor({ state: 'hidden' });
  if (await page.getByRole('textbox', { name: 'Title', exact: true }).inputValue() !== 'Keep this edited draft') throw Error('Recovery lost edited page');
  await page.getByRole('button', { name:'Save page', exact:true }).click();
  await page.getByRole('button', { name:'Saved', exact:true }).waitFor();
  if (await page.evaluate(()=>window.sidebarFixture.closes)) throw Error('Save closed the sidebar');
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Desktop platform sections, six brand marks, four placeholders, themes/widths, guide/Escape and browser offline-to-ready recovery passed. All writes isolated.');
}
