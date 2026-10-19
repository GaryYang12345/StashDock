async page => {
  await page.goto('http://127.0.0.1:5173/tests/fixtures/file-copy.html', {waitUntil:'domcontentloaded'});
  const single = page.getByRole('button',{name:'Copy single reference for AI',exact:true});
  const bulk = page.getByRole('button',{name:'Copy selection for AI',exact:true});
  for (const [button,ids] of [[single,['first']],[bulk,['first','second']]]) {
    await button.click();
    await page.waitForFunction(() => document.querySelector('button') && window.copyRequests.length > 0);
    await page.waitForTimeout(450);
    const success = await button.evaluate(el => ({text:el.textContent,background:getComputedStyle(el).backgroundColor}));
    if(!success.text.includes('Copied')) throw Error('Native file copy lost green success feedback');
    const request = await page.evaluate(() => window.copyRequests.at(-1));
    if(request.command !== 'copy_reference_file' || JSON.stringify(request.args.itemIds) !== JSON.stringify(ids)) throw Error('Incorrect native selection');
    await page.screenshot({path:`output/playwright/file-copy-${ids.length}-success.png`});
    await page.waitForTimeout(2000);
    const ready = await button.evaluate(el => ({text:el.textContent,background:getComputedStyle(el).backgroundColor}));
    if(ready.text.includes('Copied') || ready.background === success.background || await button.isDisabled()) throw Error(`Original ready feedback did not return: ${JSON.stringify({success,ready})}`);
    await page.screenshot({path:`output/playwright/file-copy-${ids.length}-ready.png`});
  }
  await page.evaluate(() => {window.failCopy=true;});
  await single.click();
  await page.getByRole('alert').filter({hasText:'Fixture clipboard locked'}).waitFor();
  if((await single.textContent()).includes('Copied')) throw Error('False copied state on native failure');
  return {single:true,multiple:true,greenThenBlack:true,nativeFailureVisible:true,requests:await page.evaluate(() => window.copyRequests)};
}
