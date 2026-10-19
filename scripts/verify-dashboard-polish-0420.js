async page => {
  await page.goto('http://127.0.0.1:5173/tests/fixtures/dashboard-polish.html',{waitUntil:'domcontentloaded'});
  for(const theme of ['light','dark'])for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});await page.locator('html').evaluate((el,theme)=>{el.dataset.theme=theme;el.dataset.accent=theme==='dark'?'blue':'neutral';},theme);await page.waitForTimeout(400);
    const g=await page.locator('main > div > section').evaluate(el=>({radius:getComputedStyle(el).borderRadius,shadow:getComputedStyle(el).boxShadow,background:getComputedStyle(el).backgroundColor,pageOverflow:document.documentElement.scrollWidth>innerWidth}));
    if(g.radius==='0px'||g.shadow==='none'||g.pageOverflow)throw Error('Dashboard layout '+JSON.stringify(g));
    const control=page.getByRole('button',{name:'Minimize to folder',exact:true});await page.mouse.move(0,0);await page.waitForTimeout(250);const idle=await control.evaluate(el=>getComputedStyle(el).backgroundColor);await control.hover();await page.waitForTimeout(250);if(idle===await control.evaluate(el=>getComputedStyle(el).backgroundColor))throw Error('Invisible window hover');
    await page.screenshot({path:`output/playwright/dashboard-${theme}-${width}-0420.png`});
  }
  return {roundedContentSurface:true,noPageOverflow:true,windowHoverInBothThemes:true,widthThemeChecks:6};
}
