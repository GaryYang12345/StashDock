import productLinks from '../../src-tauri/product-links.json' with { type: 'json' };
export const firefoxExtensionId = productLinks.browserExtensions.firefox.id;
export function validBrowserExtensionId(browser, id) {
  return browser === 'firefox' ? id === firefoxExtensionId : ['chrome', 'edge'].includes(browser) && /^[a-p]{32}$/.test(id || '');
}
// Firefox's runtime ID is stable; its moz-extension origin is a per-profile UUID.
// Chromium uses the same ID for its runtime and origin. Do not conflate them.
export function browserRegistration(browser, origin, reportedId) {
  if (!['chrome', 'edge', 'firefox'].includes(browser)) throw Error('Unsupported browser.');
  if (browser === 'firefox') {
    if (origin && !/^moz-extension:\/\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(origin)) throw Error('Invalid StashDock extension.');
    if (!validBrowserExtensionId(browser, reportedId)) throw Error('Invalid StashDock extension.');
    return reportedId;
  }
  if (origin && !origin.startsWith('chrome-extension://')) throw Error('Invalid StashDock extension.');
  const originId = origin?.match(/^chrome-extension:\/\/([a-p]{32})$/)?.[1];
  if (origin && !originId) throw Error('Invalid StashDock extension.');
  if (reportedId && originId && reportedId !== originId) throw Error('Invalid StashDock extension.');
  const id = originId || reportedId;
  if (id && !validBrowserExtensionId(browser, id)) throw Error('Invalid StashDock extension.');
  return id;
}
