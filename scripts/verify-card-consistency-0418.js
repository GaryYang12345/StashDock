async page => {
  await page.goto('http://127.0.0.1:5173/tests/fixtures/list-layout.html'); await page.setViewportSize({width:1063,height:684});
  const article=page.getByRole('article',{name:'Short title',exact:true});
  await article.click({button:'right'}); if(await page.getByRole('menu').count()) throw Error('Card right-click opens editing');
  await page.getByRole('button',{name:'Edit Short title',exact:true}).click();
  if(await page.getByRole('menuitem').count()!==2) throw Error('Three-dot menu lost edit actions');
  await page.keyboard.press('Escape');
  const tones=[];
  for(const theme of ['light','dark']) {
    await page.locator('html').evaluate((el,theme)=>el.dataset.theme=theme,theme);
    await article.hover(); await page.getByRole('button',{name:'Delete Short title',exact:true}).click();
    const ref=page.getByRole('button',{name:'Delete reference',exact:true});
    await page.waitForTimeout(350); const normal=await ref.evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.color,s.borderColor];});
    await ref.hover(); await page.waitForTimeout(350); const hover=await ref.evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.color,s.borderColor];});
    await page.getByRole('dialog').screenshot({path:`output/playwright/delete-reference-${theme}-0418.png`});
    await page.getByRole('button',{name:'Close dialog',exact:true}).click(); await page.getByRole('dialog').waitFor({state:'hidden'}); await page.waitForTimeout(200);
    await page.getByRole('button',{name:'Remove tag fixture',exact:true}).click(); const tag=page.getByRole('button',{name:'Remove tag',exact:true});
    await page.waitForTimeout(350); const tagNormal=await tag.evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.color,s.borderColor];});
    await tag.hover(); await page.waitForTimeout(350); const tagHover=await tag.evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.color,s.borderColor];});
    if(JSON.stringify(normal)!==JSON.stringify(tagNormal)||JSON.stringify(hover)!==JSON.stringify(tagHover)) throw Error('Reference and tag deletion differ: '+JSON.stringify({normal,tagNormal,hover,tagHover}));
    tones.push({theme,normal,hover}); await page.getByRole('button',{name:'Cancel',exact:true}).click(); await page.getByRole('dialog').waitFor({state:'hidden'}); await page.waitForTimeout(200);
  }
  return {cardRightClickDisabled:true,threeDotMenuIntact:true,identicalDeletionColors:tones};
}
