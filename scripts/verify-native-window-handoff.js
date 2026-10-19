async page => {
  const pages=page.context().browser().contexts().flatMap(c=>c.pages());
  page=pages.find(p=>!new URL(p.url()).searchParams.has('surface'));
  if(!page)throw Error('The panel WebView is missing.');
  const invoke=(command,args)=>page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
  const folder=pages.find(p=>new URL(p.url()).searchParams.get('surface')==='folder');
  if(!folder)throw Error('The folder WebView is missing.');
  const search=page.getByPlaceholder('Search references',{exact:true});
  const before=await invoke('plugin:window|inner_size');
  const filters=page.getByRole('navigation',{name:'Collections',exact:true});
  const initialQuery=await search.inputValue();
  const viewport=page.getByRole('region',{name:'References',exact:true});
  const initialScroll=await viewport.evaluate(node=>node.scrollTop);
  await search.fill('UI');
  await page.waitForTimeout(180);
  const node=await page.getByRole('heading',{name:'Context shelf',exact:true}).elementHandle();
  const selectedScroll=await viewport.evaluate(node=>{node.scrollTop=320;return node.scrollTop;});
  const results=[];
  const settled=async target=>{const s=await invoke('desktop_window_status');if(s.visible!==target||s.requested!==target)throw Error('Direct switch did not commit: '+target);};
  await invoke('set_desktop_surface',{target:'panel'});
  await settled('panel');
  for(let i=0;i<12;i++){
    await invoke('set_desktop_surface',{target:'folder'});
    await settled('folder');
    if((await invoke('desktop_window_status')).visible!=='folder')throw Error('Folder handoff did not commit.');
    await folder.getByRole('button',{name:'Open StashDock',exact:true}).focus();
    await folder.getByRole('button',{name:'Open StashDock',exact:true}).press('Enter');
    await settled('panel');
    await page.waitForTimeout(50);
    const size=await invoke('plugin:window|inner_size');
    results.push(size);
    if(size.width!==before.width||size.height!==before.height)throw Error('Normal handoff changed client size: '+JSON.stringify({before,size}));
    if(await search.inputValue()!=='UI')throw Error('Search was remounted/reset.');
    if(await viewport.evaluate(node=>node.scrollTop)!==selectedScroll)throw Error('Scroll position reset during handoff.');
    if(node&&!await node.evaluate(node=>node.isConnected))throw Error('The shelf was remounted.');
  }
  await search.fill(initialQuery);await page.waitForTimeout(180);
  await viewport.evaluate((node,value)=>{node.scrollTop=value;},initialScroll);
  await filters.waitFor({state:'visible'});
  // Direct native maximize/restore, not viewport emulation.
  await page.getByRole('button',{name:'Maximize window',exact:true}).click();
  await page.getByRole('button',{name:'Restore window',exact:true}).waitFor();
  await invoke('set_desktop_surface',{target:'folder'});await settled('folder');
  await invoke('set_desktop_surface',{target:'panel'});await settled('panel');
  await page.getByRole('button',{name:'Restore window',exact:true}).waitFor();
  await page.getByRole('button',{name:'Restore window',exact:true}).click();
  await page.getByRole('button',{name:'Maximize window',exact:true}).waitFor();
  await invoke('hide_stashdock');
  if((await invoke('desktop_window_status')).visible!==null)throw Error('Hide did not hide both windows.');
  await invoke('set_desktop_surface',{target:'panel'});
  const normal=await invoke('plugin:window|inner_size');
  const folderBounds=await folder.evaluate(()=>({width:innerWidth,height:innerHeight,body:document.querySelector('.desktop-folder-content').getBoundingClientRect().toJSON()}));
  if(folderBounds.width!==144||folderBounds.height!==144||folderBounds.body.top!==0)throw Error('Folder bounds are not independent.');
  return {handoffs:results.length,stableClientSize:before,restoredClientSize:normal,preservedSearchAndNodes:true,preservedScroll:true,maximizeHandoff:true,maximizeRestore:true,hideReopen:true,folderBounds};
}
