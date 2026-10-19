async page => {
  await page.goto('http://127.0.0.1:5173/tests/fixtures/modal-layout.html');
  let checked=0;
  for(const theme of ['light','dark']) for(const width of [320,390,768,1063]) for(const name of ['Edit card','Edit content','Rename tag','Remove tag','Delete reference']) {
    await page.setViewportSize({width,height:684}); await page.locator('html').evaluate((el,theme)=>el.dataset.theme=theme,theme);
    await page.getByRole('button',{name,exact:true}).click(); const dialog=page.getByRole('dialog'); await dialog.waitFor(); await page.waitForTimeout(300);
    const geometry=await dialog.evaluate(el=>{const box=el.getBoundingClientRect(), title=el.querySelector('h2'), t=title.getBoundingClientRect(), style=getComputedStyle(title), close=el.querySelector('button[aria-label="Close dialog"]').getBoundingClientRect();return {left:t.left-box.left,top:t.top-box.top,center:Math.abs(t.top+parseFloat(style.lineHeight)/2-close.top-close.height/2),overflow:el.scrollWidth>el.clientWidth,box:{left:box.left,right:box.right}};});
    const expected=width<=560?17:25;
    if(geometry.overflow || Math.abs(geometry.left-expected)>1 || Math.abs(geometry.top-expected)>1 || geometry.center>1 || geometry.box.left<0 || geometry.box.right>width) throw Error('Bad modal header: '+JSON.stringify({theme,width,name,geometry}));
    if(width===1063&&theme==='light') await dialog.screenshot({path:`output/playwright/modal-${name.toLowerCase().replaceAll(' ','-')}-0419.png`});
    await page.getByRole('button',{name:'Close dialog',exact:true}).click(); await dialog.waitFor({state:'hidden'}); await page.waitForTimeout(180); checked++;
  }
  await page.setViewportSize({width:1700,height:1100}); await page.goto('http://127.0.0.1:5173/tests/fixtures/modal-layout.html?native');
  for(const name of ['Edit card','Edit content','Rename tag','Remove tag','Delete reference']) {
    await page.getByRole('button',{name,exact:true}).click(); const dialog=page.getByRole('dialog'); await dialog.waitFor(); await page.waitForTimeout(300);
    const rect=await dialog.boundingBox(), host=await page.locator('.floating-layer').boundingBox();
    if(rect.x<host.x || rect.y<host.y || rect.x+rect.width>host.x+host.width || rect.y+rect.height>host.y+host.height) throw Error('Native modal leaves the visible pane');
    await page.getByRole('button',{name:'Close dialog',exact:true}).click(); await dialog.waitFor({state:'hidden'}); await page.waitForTimeout(180);
  }
  return {allActiveModalHeaders:checked,nativeScaledBoundaries:5,desktopPadding:24,narrowPadding:16,firstLineCloseAlignment:true};
}
