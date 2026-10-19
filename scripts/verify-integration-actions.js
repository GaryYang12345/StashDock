async page => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1180,height:1000});
  await page.goto('http://127.0.0.1:18749/tests/fixtures/settings.html');
  await page.evaluate(()=>sessionStorage.clear());await page.reload();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Set up Claude',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Set up Claude',exact:true});await dialog.waitFor();
  await dialog.getByText('Claude support is coming soon.',{exact:true}).waitFor();
  await dialog.getByText('Open Claude and ask it to install StashDock from that link.',{exact:true}).waitFor();
  if(!await dialog.getByRole('button',{name:'Copy GitHub link',exact:true}).isDisabled())throw Error('Unconfigured link can be copied');
  const open=dialog.getByRole('button',{name:'Open Claude',exact:true});
  if(!await open.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0))throw Error('Open app brand mark missing');
  await page.evaluate(()=>sessionStorage.setItem('fixture-open-failure','1'));await open.click();
  await dialog.getByText('The app could not be opened. Try again.',{exact:true}).waitFor();
  await page.evaluate(()=>sessionStorage.removeItem('fixture-open-failure'));await open.click();
  await page.waitForFunction(()=>document.documentElement.dataset.openedIntegration==='claude');
  for(const theme of ['light','dark'])for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    if(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth))throw Error('Guide overflow '+width);
    await page.screenshot({path:`output/playwright/claude-setup-${theme}-${width}.png`});
  }
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.addInitScript(()=>{
    window.fixtureCopies=[];
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{if(window.fixtureCopyError)throw Error('Fixture clipboard error');window.fixtureCopies.push(value);}}});
  });
  await page.goto('http://127.0.0.1:18749/tests/fixtures/settings.html?no-agent=1&github-fixture=1');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  const row=page.locator('[data-integration-row="codex"]');
  if(await row.locator('[data-detected]').count())throw Error('Undetected plugin claims Detected');
  await row.getByRole('button',{name:'Set up ChatGPT',exact:true}).click();
  const setup=page.getByRole('dialog',{name:'Set up ChatGPT',exact:true});await setup.waitFor();
  const copy=setup.getByRole('button',{name:'Copy GitHub link',exact:true});const idle=await copy.evaluate(el=>getComputedStyle(el).backgroundColor);
  await copy.click();await copy.getByText('Copied',{exact:true}).waitFor();
  if(await copy.evaluate(el=>getComputedStyle(el).backgroundColor)===idle)throw Error('Copied feedback did not turn green');
  if(JSON.stringify(await page.evaluate(()=>window.fixtureCopies))!==JSON.stringify(['https://github.com/example/stashdock-test-fixture']))throw Error('Wrong copied link');
  await page.screenshot({path:'output/playwright/github-copy-success.png'});
  await page.waitForFunction(()=>document.querySelector('button[aria-label="Copy GitHub link"]').textContent.trim()==='Copy');
  await page.evaluate(()=>window.fixtureCopyError=true);await copy.click();
  await setup.getByText('Clipboard access was blocked. Try again from the active window.',{exact:true}).waitFor();
  if(errors.length)throw Error(errors.join('\n'));
  return 'Claude setup preview, real brand marks, unavailable placeholder, app callback/error/retry, both themes/five widths, undetected ChatGPT setup and isolated GitHub copy/green/reset/error passed. No real app launch or clipboard write.';
}
