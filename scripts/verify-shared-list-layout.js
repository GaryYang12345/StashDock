async page => {
  await page.goto('http://127.0.0.1:5173/tests/fixtures/list-layout.html');
  for(const width of [320,390,439,768,1024,1440]) {
    await page.setViewportSize({width,height:800});
    await page.getByRole('article',{name:'Short title',exact:true}).waitFor();
    const geometry=await page.locator('article').evaluateAll(rows=>rows.map(row=>({height:row.getBoundingClientRect().height,overflow:row.scrollWidth>row.clientWidth,headline:row.querySelector('h3').getBoundingClientRect().height})));
    if(geometry.some(row=>row.height!==84 || row.overflow || row.headline>22)) throw Error('Unequal or overflowing list rows: '+JSON.stringify({width,geometry}));
    await page.getByRole('article',{name:'Short title',exact:true}).hover();
    await page.getByRole('button',{name:'Delete Short title',exact:true}).click();
    const button=page.getByRole('button',{name:'Delete reference',exact:true}); await button.hover();
    const tone=await button.evaluate(node=>{const style=getComputedStyle(node);return {background:style.backgroundColor,border:style.borderColor,color:style.color};});
    if(tone.background===tone.color || tone.background==='rgb(255, 255, 255)' || tone.background==='rgb(245, 245, 245)') throw Error('Missing semantic destructive fill: '+JSON.stringify(tone));
    if(width===439) await page.getByRole('dialog').screenshot({path:'output/playwright/delete-action-0417.png'});
    await button.click(); await page.getByRole('dialog').waitFor({state:'hidden'}); await page.waitForTimeout(300);
  }
  await page.setViewportSize({width:439,height:800}); await page.screenshot({path:'output/playwright/shared-list-0417.png'});
  return {widths:6,fixedRows:84,oneLineTitles:true,groupedList:true,noOverflow:true,destructiveFill:true};
}
