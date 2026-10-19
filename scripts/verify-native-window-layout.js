async page => {
  page=page.context().browser().contexts().flatMap(c=>c.pages()).find(p=>!new URL(p.url()).searchParams.has('surface'));
  if(!page)throw Error('Native panel missing.');
  const invoke=(command,args)=>page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
  const initial=await invoke('plugin:window|inner_size');
  const themes=[];
  const previousTheme=await page.evaluate(()=>document.documentElement.getAttribute('data-theme'));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  try {
    for(const theme of ['light','dark']){
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      for(const width of [390,768,1180,1440]){
        await invoke('plugin:window|set_size',{value:{Logical:{width,height:760}}});
        await page.waitForTimeout(120);
        const layout=await page.evaluate(()=>({viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth+1,
          content:document.querySelector('[aria-label="References"]').getBoundingClientRect().toJSON()}));
        if(layout.overflow)throw Error('Horizontal overflow at '+width);
        if(layout.content.height<300||layout.content.y>330)throw Error('Navigation crowds out cards at '+width+': '+JSON.stringify(layout));
        if(width<=880){
          await page.getByRole('button',{name:'Tags',exact:true}).click();
          const tags=page.getByRole('menu',{name:'Tags',exact:true});
          const box=await tags.boundingBox();
          if(!box||box.x<0||box.y+box.height>layout.viewport[1]+1)throw Error('Compact tags clipped');
          await page.keyboard.press('Escape');
          await tags.waitFor({state:'hidden'});
        }
        await page.getByRole('button',{name:'Import references',exact:true}).focus();
        await page.getByRole('button',{name:'Import references',exact:true}).press('Enter');
        const dialog=page.getByRole('dialog',{name:'Import references',exact:true});
        for(const [tab,save]of [['Note','Save note'],['File','Save file'],['Link','Save link']]){
          await dialog.getByRole('tab',{name:tab,exact:true}).click();
          await page.waitForTimeout(180);
          const bounds=await dialog.boundingBox(),button=await dialog.getByRole('button',{name:save,exact:true}).boundingBox();
          if(!bounds||!button||bounds.x<0||bounds.y<0||bounds.x+bounds.width>layout.viewport[0]+1||button.y+button.height>layout.viewport[1]+1)throw Error('Import/Save clipping at '+width+' '+tab);
        }
        await dialog.getByRole('tab',{name:'Note',exact:true}).click();
        await page.waitForTimeout(180);
        await dialog.getByRole('button',{name:'Choose tags',exact:true}).click();
        const picker=page.getByRole('dialog',{name:'Choose existing tags',exact:true});
        const bounds=await picker.boundingBox();
        if(!bounds||bounds.x<0||bounds.y<0||bounds.x+bounds.width>layout.viewport[0]+1||bounds.y+bounds.height>layout.viewport[1]+1)throw Error('Tag picker clipping at '+width);
        await page.keyboard.press('Escape');
        await picker.waitFor({state:'hidden'});
        await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();
        await dialog.waitFor({state:'hidden'});
        themes.push({theme,width,layout});
      }
    }
  } finally {
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.evaluate(theme=>{if(theme===null)delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=theme;},previousTheme);
    await invoke('plugin:window|set_size',{value:{Physical:initial}});
  }
  await page.screenshot({path:'output/playwright/native-architecture-final.png',scale:'css'});
  return {realNativeSizes:true,cases:themes.length,importSaveAndTagsWithinBounds:true};
}
