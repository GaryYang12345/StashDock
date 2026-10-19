// Shared import/editor fixture only. Never touches a real collection.
async page => {
  await page.goto('http://127.0.0.1:5173/tests/fixtures/desktop-import.html');
  for (const mode of ['import','editor']) {
    for (const width of [320,390,768,1024,1440]) {
      await page.setViewportSize({width,height:684});
      await page.getByRole('button',{name:`Open ${mode} fixture`,exact:true}).click();
      if(mode==='import') { await page.getByRole('tab',{name:'File',exact:true}).click(); await page.locator('input[type=file]').setInputFiles({name:'Fixture.txt',mimeType:'text/plain',buffer:Buffer.from('Fixture content')}); }
      const dialog=page.getByRole('dialog',{name:mode==='editor'?'Edit card':'Import references',exact:true});
      await dialog.waitFor();
      await page.waitForTimeout(550);
      if(await page.getByRole('button',{name:'Add tag UI',exact:true}).count()) throw Error('Suggestions are not collapsed');
      const field=page.getByRole('textbox',{name:'Tags',exact:true});
      await field.click(); await field.fill('Direct tag');
      if(await page.getByRole('dialog',{name:'Choose existing tags'}).count()) throw Error('Typing opened suggestions');
      await field.press('Enter'); await page.getByRole('button',{name:'Remove Direct tag',exact:true}).waitFor();
      const before=await dialog.evaluate(el=>el.getBoundingClientRect().height);
      const trigger=page.getByRole('button',{name:'Choose tags',exact:true}); await trigger.click();
      const label=await dialog.locator('label').filter({hasText:/^Tags$/}).boundingBox();
      const triggerBounds=await trigger.boundingBox();
      if(Math.abs(label.y+label.height/2-triggerBounds.y-triggerBounds.height/2)>3) throw Error('Choose tags is not beside the Tags label');
      const inputBounds=await field.boundingBox();
      if(triggerBounds.y+triggerBounds.height>inputBounds.y-4) throw Error('Choose tags overlaps the input');
      const picker=page.getByRole('dialog',{name:'Choose existing tags',exact:true}); await picker.waitFor();
      await page.waitForTimeout(300);
      const bounds=await picker.evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,overflow:el.scrollWidth>el.clientWidth}));
      if(bounds.left<0 || bounds.right>width || bounds.top<0 || bounds.bottom>684 || bounds.overflow) throw Error('Clipped picker: '+JSON.stringify(bounds));
      if(Math.abs(before-await dialog.evaluate(el=>el.getBoundingClientRect().height))>2) throw Error('Picker expanded form height');
      await page.getByRole('textbox',{name:'Find tags',exact:true}).fill('UI');
      await page.getByRole('button',{name:'Add tag UI',exact:true}).click();
      if(!await page.getByRole('button',{name:'Add tag UI',exact:true}).isDisabled()) throw Error('Selected suggestion was removed or stays active');
      await page.keyboard.press('Escape'); await picker.waitFor({state:'hidden'});
      if(!await dialog.isVisible() || !await trigger.evaluate(el=>el===document.activeElement)) throw Error('Escape closed parent or lost focus');
      if(width===390) {
        await dialog.screenshot({path:`output/playwright/tags-${mode}-collapsed-0414.png`});
        await trigger.click(); await picker.screenshot({path:`output/playwright/tags-${mode}-picker-0414.png`}); await page.keyboard.press('Escape');
      }
      if(mode==='editor') {
        await page.getByRole('button',{name:'Save changes',exact:true}).click(); await dialog.waitFor({state:'hidden'});
        const item=JSON.parse(await page.locator('#saved-items').innerText())[0]; if(item.tags.join('|')!=='Direct tag|UI') throw Error('Editor tags not saved');
      } else { await page.getByRole('button',{name:'Close dialog',exact:true}).click(); await dialog.waitFor({state:'hidden'}); }
      await page.waitForTimeout(300);
    }
  }
  await page.setViewportSize({width:1700,height:1100});
  await page.goto('http://127.0.0.1:5173/tests/fixtures/desktop-import.html?native');
  await page.getByRole('button',{name:'Open editor fixture',exact:true}).click();
  const nativeDialog=page.getByRole('dialog',{name:'Edit card',exact:true}); await nativeDialog.waitFor();
  await page.getByRole('button',{name:'Choose tags',exact:true}).click();
  const nativePicker=page.getByRole('dialog',{name:'Choose existing tags',exact:true}); await nativePicker.waitFor();
  await page.waitForTimeout(450);
  const pane=await page.locator('.floating-layer').boundingBox(), floating=await nativePicker.boundingBox();
  if(floating.x<pane.x+8 || floating.y<pane.y+8 || floating.x+floating.width>pane.x+pane.width-8 || floating.y+floating.height>pane.y+pane.height-8) throw Error('Picker leaves the visible scaled native pane: '+JSON.stringify({pane,floating}));
  const tagsScroll=nativePicker.getByRole('region',{name:'Existing tags',exact:true});
  await tagsScroll.evaluate(el=>el.scrollTop=el.scrollHeight); await page.waitForTimeout(120);
  if(!await nativePicker.getByRole('button',{name:'Add tag Existing tag 79',exact:true}).isVisible()) throw Error('Final suggestion unreachable');
  await page.screenshot({path:'output/playwright/tags-native-boundary-0416.png'});
  await page.keyboard.press('Escape'); await nativePicker.waitFor({state:'hidden'});
  return {clickOnly:true,headerAligned:true,nativeScaledBoundary:true,searchAndSelect:true,selectedSuggestionsKept:true,formHeightUnchanged:true,escapeAndFocus:true,editorSavesAndCloses:true,widths:5};
}
