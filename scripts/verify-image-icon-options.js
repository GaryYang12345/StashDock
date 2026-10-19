async page => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const theme of ['light','dark'])for(const width of [390,1440]) {
    await page.setViewportSize({width,height:1000});
    await page.goto(`http://127.0.0.1:18752/?theme=${theme}`);
    if(await page.locator('figure').count()!==7||await page.locator('figure svg').count()!==21)throw Error('Missing candidate icons');
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Candidate gallery overflow');
    await page.screenshot({path:`output/playwright/image-options-${theme}-${width}.png`,fullPage:true});
  }
  if(errors.length)throw Error(errors.join('\n'));
  console.log('Seven upstream candidates, cover/source sizes, both themes and narrow/wide layouts passed.');
}
