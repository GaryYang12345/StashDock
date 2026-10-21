// Keep the screenshot and text tied to the same active document. Browser
// captureVisibleTab otherwise silently photographs a newly selected tab.
export async function captureActivePage(chromeApi, expected, resize, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), isCurrent = () => true, options = {}) {
  const url = new URL(expected.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('Open an HTTP or HTTPS page to save a reference.');
  const tab = async () => {
    if (!isCurrent()) throw Error('A newer page is being read.');
    const [current] = await chromeApi.tabs.query({ active: true, windowId: expected.windowId });
    if (!current || current.id !== expected.tabId || current.url !== expected.url || current.status === 'loading') {
      throw Error('The page changed. Wait for it to load and save it again.');
    }
    return current;
  };
  const initial = await tab();
  let changed = false;
  const activated = info => { if (info.windowId === expected.windowId && info.tabId !== expected.tabId) changed = true; };
  const updated = (id, info) => { if (id === expected.tabId && ((info.url && info.url !== expected.url) || info.status === 'loading')) changed = true; };
  chromeApi.tabs.onActivated.addListener(activated);
  chromeApi.tabs.onUpdated.addListener(updated);
  try {
    let results, loaded = [];
    try { loaded = await chromeApi.scripting.executeScript({ target: { tabId: expected.tabId }, world: 'ISOLATED', files: ['ui/page-capture.js'] }); }
    catch { /* Restricted documents (including some PDF viewers) can still be bookmarked. */ }
    await tab();
    if (changed) throw Error('The page changed during capture. Save it again.');
    const documentId = loaded.find(result => result.frameId === 0)?.documentId ?? loaded[0]?.documentId;
    options.onDocument?.(documentId);
    const target = { tabId: expected.tabId, ...(documentId ? { documentIds: [documentId] } : { frameIds: [0] }) };
    if (loaded.length && options.watchToken) {
      try { await chromeApi.scripting.executeScript({target,world:'ISOLATED',func:token=>globalThis.StashDockPageCapture.observeCurrentDocument(token),args:[options.watchToken]}); }
      catch { /* Watching is optional; document identity is still checked below. */ }
    }
    let signature, quiet = 0;
    for (let attempt = 0; attempt < (options.settle ? 12 : 5); attempt++) {
      if (!loaded.length) break;
      await tab();
      if (changed) throw Error('The page changed during capture. Save it again.');
      try {
      results = await chromeApi.scripting.executeScript({
        target,
        world: 'ISOLATED',
        func: () => globalThis.StashDockPageCapture?.captureCurrentDocument() ?? { error: 'The page reader did not load. Retry reading the current page.' },
      });
      }
      catch { break; /* Keep the link if reading access expired; recheck navigation below. */ }
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
    const injection = results?.find(result => result.frameId === 0) ?? results?.[0];
    const page = injection?.result?.page ?? { url: expected.url, title: initial.title || url.hostname, content: '', captureMethod: 'page' };
    if (page.url !== expected.url || typeof page.content !== 'string') throw Error('The page changed. Retry reading the current page.');
    await tab();
    let screenshot;
    // Chrome limits screenshots across all extension windows. Retry only that
    // quota, and recheck identity after waiting; never photograph another tab.
    for (let attempt = 0; attempt < 3; attempt++) {
      await tab();
      if (changed) throw Error('The page changed during capture. Save it again.');
      try { screenshot = await chromeApi.tabs.captureVisibleTab(expected.windowId, { format: 'jpeg', quality: 72 }); break; }
      catch (error) {
        // Screenshots are optional enrichment, not permission to save a link.
        // Identity/permission checks above remain mandatory and fail closed.
        if (!String(error?.message).includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND') || attempt === 2) break;
        await pause(1100);
      }
    }
    await tab();
    if (changed) throw Error('The page changed during capture. Save it again.');
    let preview;
    if (screenshot) {
      try { preview = await resize(screenshot, page.viewport); }
      catch { /* Keep the valid link and text if raster conversion fails. */ }
    }
    await tab();
    if (changed) throw Error('The page changed during capture. Save it again.');
    return { ...expected, ...page, documentId, preview, previewKind: preview ? 'screenshot' : undefined };
  } finally {
    chromeApi.tabs.onActivated.removeListener(activated);
    chromeApi.tabs.onUpdated.removeListener(updated);
  }
}
