async page => {
  await page.goto('http://127.0.0.1:18747');
  const ui=page.frameLocator('iframe');
  await page.setViewportSize({width:1063,height:900});
  const file=ui.getByRole('article',{name:'Edited file title',exact:true}); await file.waitFor();
  await file.click({button:'right'}); if(await ui.getByRole('menu').count()) throw Error('MCP card right-click still edits');
  if(!await file.getByText('Text file',{exact:true}).count() || !await file.getByRole('button',{name:'Open Edited file title',exact:true}).count()) throw Error('File icon/identity/open action missing');
  await file.getByRole('button',{name:'More options for Edited file title',exact:true}).click();
  if(await ui.getByRole('menuitem').count()!==2) throw Error('MCP three-dot menu not consistent');
  await page.keyboard.press('Escape');
  await file.hover(); await file.getByRole('button',{name:'Delete Edited file title',exact:true}).click();
  const button=ui.getByRole('button',{name:'Delete reference',exact:true}); await button.hover(); await page.waitForTimeout(350);
  const tone=await button.evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.color,s.borderColor];});
  if(tone[0]!=='oklab(0.9356 0.0266454 0.012425)' || tone[1]!=='oklch(0.54 0.21 25)') throw Error('MCP/desktop deletion colors differ: '+JSON.stringify(tone));
  await ui.getByRole('button',{name:'Keep reference',exact:true}).click(); await ui.getByRole('dialog').waitFor({state:'hidden'});
  return {cardRightClickDisabled:true,threeDotMenuIntact:true,fileTypeIdentityAndOpen:true,desktopDeletionColorMatch:true};
}
