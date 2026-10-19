async page => {
  const context=page.context();
  let worker=context.serviceWorkers().find(w=>w.url().endsWith('/background.js'));
  const before=await worker.evaluate(async()=>{await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});return chrome.sidePanel.getPanelBehavior();});
  if(!before.openPanelOnActionClick)throw Error('The upgrade fixture did not reproduce old behavior.');
  const started=context.waitForEvent('serviceworker',{timeout:15000});
  await worker.evaluate(()=>chrome.runtime.reload()).catch(error=>{if(!/closed|destroyed|Execution context/i.test(error.message))throw error;});
  worker=await started;
  for(let n=0;n<40;n++){
    const behavior=await worker.evaluate(()=>chrome.sidePanel.getPanelBehavior());
    if(!behavior.openPanelOnActionClick)return {oldBehavior:true,afterReload:false,existingProfileMigrated:true,version:await worker.evaluate(()=>chrome.runtime.getManifest().version)};
    await page.waitForTimeout(50);
  }
  throw Error('An upgraded profile still bypasses the capture gesture.');
}
