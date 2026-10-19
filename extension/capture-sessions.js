// One current-page task per open sidebar window. No background tab listeners:
// only a live sidebar or its explicit toolbar gesture can start a read.
export function createCaptureSessions(api, capture, resize, pause = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const tasks = new Map();
  const epochs = new Map();
  const intents = new Map();
  const writes = new Map();
  const key = windowId => `stashdock-sidepanel:${windowId}`;
  const active = async windowId => (await api.tabs.query({ active: true, windowId }))[0];
  function commit(windowId, action) {
    const next=(writes.get(windowId)||Promise.resolve()).catch(()=>{}).then(action);
    writes.set(windowId,next);
    void next.finally(()=>{if(writes.get(windowId)===next)writes.delete(windowId);}).catch(()=>{});
    return next;
  }
  const publish = task => commit(task.entry.expected.windowId,()=>tasks.get(task.entry.expected.windowId)===task ? api.storage.session.set({[key(task.entry.expected.windowId)]:task.entry}) : undefined);
  const stop = async task => {
    const expected=task?.entry.expected,documentId=task?.entry.documentId;
    if(!expected||!documentId)return;
    // Cancelling our own injected observer does not need fresh site access,
    // including after the user revokes optional host permissions.
    if(api.tabs.sendMessage){try{await api.tabs.sendMessage(expected.tabId,{type:'stop-page-watch',token:task.entry.token},{documentId});return;}catch{/* Observer may not have installed yet. */}}
    if(!api.scripting)return;
    try{await api.scripting.executeScript({target:{tabId:expected.tabId,documentIds:[documentId]},world:'ISOLATED',func:token=>globalThis.StashDockPageCapture?.stopObservingDocument(token),args:[task.entry.token]});}catch{/* Navigated/closed document. */}
  };
  const captureOptions = task => ({settle:true,watchToken:task.entry.token,onDocument:id=>{if(tasks.get(task.entry.expected.windowId)===task)task.entry.documentId=id;}});
  async function read(windowId, force = false, epoch = epochs.get(windowId) || 0) {
    const intent=(intents.get(windowId)||0)+(force?1:0);
    if(force)intents.set(windowId,intent);
    const tab = await active(windowId);
    if (!tab?.id) throw Error('Open a webpage to save it.');
    const running = tasks.get(windowId);
    const saved = running?.entry ?? (await api.storage.session.get(key(windowId)))[key(windowId)];
    if ((epochs.get(windowId) || 0) !== epoch) throw Error('The sidebar was closed.');
    if((intents.get(windowId)||0)!==intent)return read(windowId,false,epoch);
    if (!force && saved?.expected?.tabId === tab.id && (running?.entry.loading || (!saved.loading && tab.status !== 'loading' && saved.expected.url === tab.url))) return saved;
    void stop(running || (saved && {entry:saved}));
    const entry = { token: crypto.randomUUID(), createdAt:new Date().toISOString(), revision:0, expected: { tabId: tab.id, windowId, url: tab.pendingUrl || tab.url || '' }, title: tab.title, faviconUrl: tab.favIconUrl, loading: true };
    const task = { entry };
    tasks.set(windowId, task);
    const current = () => tasks.get(windowId) === task;
    await publish(task);
    void (async () => {
      try {
        let loaded;
        for (let attempt = 0; attempt < 150 && current(); attempt++) {
          loaded = await active(windowId);
          if (loaded?.id !== entry.expected.tabId) throw Error('The page changed. Retry reading the current page.');
          if (loaded.status !== 'loading') break;
          await pause(100);
        }
        if (!current()) return;
        if (loaded?.status === 'loading') throw Error('The page is still loading. Wait a moment, then retry.');
        if (!/^https?:\/\//.test(loaded?.url || '')) throw Error('This page is unavailable or needs website access. Allow StashDock website access, then retry.');
        entry.expected.url = loaded.url;
        entry.title = loaded.title;
        entry.faviconUrl = loaded.favIconUrl;
        entry.page = await capture(api, entry.expected, resize, pause, current, captureOptions(task));
      } catch (error) { entry.error = error.message || 'This page could not be read. Retry.'; }
      entry.loading = false;
      if (current()) {
        await publish(task);
        if(task.needsRefresh){task.needsRefresh=false;void refresh(windowId,entry.token,entry.documentId).catch(()=>{});}
      }
    })().catch(() => { /* Storage failure is recovered by the sidebar's bounded polling/retry. */ });
    return entry;
  }
  async function close(windowId) {
    epochs.set(windowId, (epochs.get(windowId) || 0) + 1);
    const previous=tasks.get(windowId);tasks.delete(windowId);
    const stored=previous?null:api.storage.session.get(key(windowId));
    const removed=commit(windowId,()=>api.storage.session.remove(key(windowId)));
    if(previous)void stop(previous);
    else void stored.then(value=>stop({entry:value[key(windowId)]})).catch(()=>{});
    await removed;
  }
  async function refresh(windowId, token, documentId) {
    const epoch=epochs.get(windowId)||0;
    let task=tasks.get(windowId);
    if(!task){const entry=(await api.storage.session.get(key(windowId)))[key(windowId)];if((epochs.get(windowId)||0)!==epoch||!entry||entry.token!==token||entry.loading)return;task={entry};tasks.set(windowId,task);}
    const entry=task.entry;
    if(entry.token!==token||entry.documentId!==documentId)return;
    if(entry.loading||task.enriching){task.needsRefresh=true;return;}
    const tab=await active(windowId);
    if(tasks.get(windowId)!==task)return;
    if(tab?.id!==entry.expected.tabId||tab.url!==entry.expected.url||tab.status==='loading')return;
    // A second notification can arrive while the active-tab lookup is pending.
    if(task.enriching){task.needsRefresh=true;return;}
    task.enriching=true;
    try{
      const page=await capture(api,entry.expected,resize,pause,()=>tasks.get(windowId)===task,captureOptions(task));
      if(tasks.get(windowId)!==task)return;
      entry.page=page;delete entry.error;entry.revision=(entry.revision||0)+1;
      await publish(task);
    }catch{/* Keep a valid draft, or its meaningful original read error, for retry. */}
    finally{task.enriching=false;if(task.needsRefresh&&tasks.get(windowId)===task){task.needsRefresh=false;void refresh(windowId,token,documentId).catch(()=>{});}}
  }
  return { read, close, refresh, epoch: windowId => epochs.get(windowId) || 0 };
}
