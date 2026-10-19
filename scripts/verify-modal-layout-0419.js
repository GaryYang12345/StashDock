async page => {
  await page.goto('http://127.0.0.1:5173/tests/fixtures/desktop-import.html'); await page.setViewportSize({width:1063,height:684});
  await page.getByRole('button',{name:'Open import fixture',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Import references',exact:true}); await dialog.waitFor(); await page.waitForTimeout(500);
  const start=await dialog.boundingBox(); const samples=[];
  for(const mode of ['Note','File','Link','File','Note','Link']) {
    await page.getByRole('tab',{name:mode,exact:true}).click();
    for(let i=0;i<8;i++) { const box=await dialog.boundingBox(); samples.push(box); await page.waitForTimeout(25); }
  }
  if(samples.some(box=>Math.abs(box.height-start.height)>1 || Math.abs(box.y-start.y)>1)) throw Error('Import dialog shifts during switching: '+JSON.stringify({start,samples}));
  const tabGeometry=await page.getByRole('tab').evaluateAll(tabs=>tabs.map(tab=>{const box=tab.getBoundingClientRect(), label=tab.lastElementChild.firstElementChild.getBoundingClientRect(); return {width:box.width,x:box.x,centerError:Math.abs((label.left+label.right-box.left-box.right)/2),verticalError:Math.abs((label.top+label.bottom-box.top-box.bottom)/2)};}));
  if(tabGeometry.some(tab=>tab.centerError>1 || tab.verticalError>1 || Math.abs(tab.width-tabGeometry[0].width)>1)) throw Error('Tab label not centered: '+JSON.stringify(tabGeometry));
  const padding=await dialog.evaluate(el=>{const rect=el.getBoundingClientRect(), h=el.querySelector('h2'), header=h.closest('div').parentElement, close=header.querySelector('button'), label=h.getBoundingClientRect(), c=close.getBoundingClientRect();return {left:label.left-rect.left,top:label.top-rect.top,closeCenter:Math.abs((label.top+label.bottom-c.top-c.bottom)/2)};});
  if(Math.abs(padding.left-25)>1 || Math.abs(padding.top-25)>1 || padding.closeCenter>1) throw Error('Dialog header spacing: '+JSON.stringify(padding));
  await page.getByRole('textbox',{name:'Link',exact:true}).fill('https://example.org/preview'); await page.waitForTimeout(1500);
  await dialog.screenshot({path:'output/playwright/import-stable-link-0419.png'});
  await page.getByRole('tab',{name:'File',exact:true}).click(); await page.locator('input[type=file]').setInputFiles({name:'Fixture.txt',mimeType:'text/plain',buffer:Buffer.from('Original content')}); await page.waitForTimeout(500);
  const fileScroll=await page.getByRole('tabpanel').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight}));
  await dialog.screenshot({path:'output/playwright/import-stable-file-0419.png'});
  await page.getByRole('button',{name:'Choose tags',exact:true}).click(); const picker=page.getByRole('dialog',{name:'Choose existing tags',exact:true}); await picker.waitFor(); await page.waitForTimeout(300);
  const region=picker.getByRole('region',{name:'Existing tags',exact:true}); await region.evaluate(el=>el.scrollTop=24); await page.waitForTimeout(100);
  if(await region.evaluate(el=>getComputedStyle(el).maskImage)!=='none') throw Error('Interactive tags still fade');
  await picker.screenshot({path:'output/playwright/tags-unmasked-0419.png'});
  await page.keyboard.press('Escape'); await picker.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Close dialog',exact:true}).click(); await dialog.waitFor({state:'hidden'});
  return {stableImportGeometry:true,equalCenteredTabs:tabGeometry,headerPadding:padding,fileScroll,tagMaskRemoved:true};
}
