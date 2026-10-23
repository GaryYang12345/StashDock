// Isolated browser profile and browser-only seed library. No desktop mutations.
async page => {
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('heading',{name:'Context library',exact:true}).waitFor();
  await page.locator('article').first().waitFor();
  const report = {widths:[],keyboard:false,copy:false,multiDrag:false};
  for(const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:1000});
    await page.evaluate(()=>document.fonts.ready);
    const layout=await page.evaluate(()=>({
      width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,
      clippedActions:[...document.querySelectorAll('article button')].some(button=>{
        const a=button.closest('article').getBoundingClientRect(),b=button.getBoundingClientRect();
        return b.right>a.right+1||b.left<a.left-1;
      }),
    }));
    if(layout.overflow||layout.clippedActions) throw Error('Card overflow at '+width);
    report.widths.push(width);
  }
  await page.screenshot({path:'output/playwright/arc-cards-light.png',animations:'disabled'});
  const first=page.locator('article').first();
  const select=first.getByRole('button',{name:/^Add .+ to context$/});
  await select.focus(); await page.keyboard.press('Enter');
  if(await first.getByRole('button',{name:/^Remove .+ from context$/}).getAttribute('aria-pressed')!=='true') throw Error('Keyboard selection failed');
  report.keyboard=true;
  await page.locator('article').nth(1).hover();
  await page.locator('article').nth(1).getByRole('button',{name:/^Add .+ to context$/}).click();
  const drag=await first.evaluate(el=>{
    const transfer=new DataTransfer();el.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));
    return {plain:transfer.getData('text/plain'),markdown:transfer.getData('text/markdown'),urls:transfer.getData('text/uri-list')};
  });
  if(drag.plain!==drag.markdown||(drag.plain.match(/^## /gm)||[]).length!==2) throw Error('Multi-selection drag failed');
  report.multiDrag=true;
  await first.getByRole('button',{name:/^Copy .+ for AI$/}).click();
  await first.getByRole('button',{name:/^Copy .+ for AI$/}).filter({hasText:'Copied'}).waitFor();
  report.copy=true;
  await page.getByRole('button',{name:'List',exact:true}).click();
  for(const width of [390,768,1024,1440]) {
    await page.setViewportSize({width,height:1000});
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error('List overflow at '+width);
  }
  await page.screenshot({path:'output/playwright/arc-list-light.png',animations:'disabled'});
  await page.getByRole('button',{name:'Grid',exact:true}).click();
  await page.evaluate(()=>{document.documentElement.dataset.theme='dark';document.documentElement.dataset.accent='blue';});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.screenshot({path:'output/playwright/arc-cards-dark.png',animations:'disabled'});
  await page.evaluate(()=>{delete document.documentElement.dataset.theme;delete document.documentElement.dataset.accent;});
  return report;
}
