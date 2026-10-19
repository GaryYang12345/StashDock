// Keep the screenshot and text tied to the same active document. Browser
// captureVisibleTab otherwise silently photographs a newly selected tab.
export async function captureActivePage(chromeApi, expected, resize, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), isCurrent = () => true, options = {}) {
  const tab = async () => {
    if (!isCurrent()) throw Error('A newer page is being read.');
    const [current] = await chromeApi.tabs.query({ active: true, windowId: expected.windowId });
    if (!current || current.id !== expected.tabId || current.url !== expected.url || current.status === 'loading') {
      throw Error('The page changed. Wait for it to load and save it again.');
    }
    return current;
  };
  await tab();
  let changed = false;
  const activated = info => { if (info.windowId === expected.windowId && info.tabId !== expected.tabId) changed = true; };
  const updated = (id, info) => { if (id === expected.tabId && ((info.url && info.url !== expected.url) || info.status === 'loading')) changed = true; };
  chromeApi.tabs.onActivated.addListener(activated);
  chromeApi.tabs.onUpdated.addListener(updated);
  try {
    let results, loaded;
    try { loaded = await chromeApi.scripting.executeScript({ target: { tabId: expected.tabId }, world: 'ISOLATED', files: ['ui/page-capture.js'] }); }
    catch { throw Error('Page access is unavailable. Click the StashDock browser toolbar icon on this page, then retry.'); }
    await tab();
    if (changed) throw Error('The page changed during capture. Save it again.');
    const documentId = loaded.find(result => result.frameId === 0)?.documentId ?? loaded[0]?.documentId;
    options.onDocument?.(documentId);
    const target = { tabId: expected.tabId, ...(documentId ? { documentIds: [documentId] } : { frameIds: [0] }) };
    if (options.watchToken) await chromeApi.scripting.executeScript({target,world:'ISOLATED',func:token=>globalThis.StashDockPageCapture.observeCurrentDocument(token),args:[options.watchToken]});
    let signature, quiet = 0;
    for (let attempt = 0; attempt < (options.settle ? 12 : 5); attempt++) {
      await tab();
      if (changed) throw Error('The page changed during capture. Save it again.');
      try {
      results = await chromeApi.scripting.executeScript({
        target,
        world: 'ISOLATED',
        func: () => globalThis.StashDockPageCapture?.captureCurrentDocument() ?? { error: 'The page reader did not load. Retry reading the current page.' },
      });
      }
      catch { throw Error('The page changed or access expired. Click the StashDock browser toolbar icon on this page, then retry.'); }
      const result = (results.find(result => result.frameId === 0) ?? results[0])?.result;
      if (result?.page && options.settle) {
        const next = JSON.stringify([result.page.title,result.page.content,result.page.truncated]);
        quiet = next === signature ? quiet + 1 : 0;
        signature = next;
        if (quiet >= 2) break;
        await pause(400);
        continue;
      }
      quiet = 0;
      if (!result?.retryable || attempt === (options.settle ? 11 : 4)) break;
      // SPA posts can arrive after Chrome marks the document complete. Keep
      // waiting briefly on this same document, never an unrelated feed/page.
      await pause(500);
    }
    const injection = results.find(result => result.frameId === 0) ?? results[0];
    if (injection?.result?.error) throw Error(injection.result.error);
    const page = injection?.result?.page;
    if (!page || page.url !== expected.url || !page.content?.trim()) throw Error('The page could not be read. Wait for its content, then retry reading the current page.');
    await tab();
    let screenshot;
    // Chrome limits screenshots across all extension windows. Retry only that
    // quota, and recheck identity after waiting; never photograph another tab.
    for (let attempt = 0; attempt < 3; attempt++) {
      await tab();
      if (changed) throw Error('The page changed during capture. Save it again.');
      try { screenshot = await chromeApi.tabs.captureVisibleTab(expected.windowId, { format: 'jpeg', quality: 72 }); break; }
      catch (error) {
        if (!String(error?.message).includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) throw error;
        if (attempt === 2) throw Error('Screenshot capture is busy. Wait a moment, then retry.');
        await pause(1100);
      }
    }
    await tab();
    if (changed) throw Error('The page changed during capture. Save it again.');
    const preview = await resize(screenshot, page.viewport);
    await tab();
    if (changed) throw Error('The page changed during capture. Save it again.');
    return { ...expected, ...page, documentId, preview, previewKind: 'screenshot' };
  } finally {
    chromeApi.tabs.onActivated.removeListener(activated);
    chromeApi.tabs.onUpdated.removeListener(updated);
  }
}
