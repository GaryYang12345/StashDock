async page => {
  await page.setViewportSize({width:1440,height:1100});await page.goto('http://127.0.0.1:5173/tests/fixtures/desktop-import.html?native',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Open import fixture',exact:true}).click();const d=page.getByRole('dialog',{name:'Import references',exact:true});await d.waitFor();await page.waitForTimeout(600);
  let frames=0;
  for(const mode of ['Note','File','Link','Note','Link','File']){
    await page.getByRole('tab',{name:mode,exact:true}).click();await page.waitForTimeout(70);
    const r=await d.boundingBox(),host=await page.locator('.floating-layer').boundingBox();
    if(r.x<host.x+12||r.y<host.y+12||r.x+r.width>host.x+host.width-12||r.y+r.height>host.y+host.height-12)throw Error('Native motion leaves host');frames++;
  }
  await page.waitForTimeout(600);await page.locator('input[type=file]').setInputFiles({name:'Test.txt',mimeType:'text/plain',buffer:Buffer.from('Test')});await page.waitForTimeout(700);
  await page.getByRole('button',{name:'Save file',exact:true}).click();await d.waitFor({state:'hidden'});
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Open import fixture',exact:true}).click();await d.waitFor();
  const sizes=[];for(const mode of ['Link','Note','File']){await page.getByRole('tab',{name:mode,exact:true}).click();await page.waitForTimeout(80);sizes.push((await d.boundingBox()).height);}
  if(Math.max(...sizes)-Math.min(...sizes)<40)throw Error('Reduced-motion native fixed height');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();await d.waitFor({state:'hidden'});await page.emulateMedia({reducedMotion:'no-preference'});
  return {rapidReversalFrames:frames,nativeBounds:true,nativeSaveReachable:true,reducedMotionSizes:sizes};
}
