// Only browser-owned sidebar APIs differ. Capture, RPC and Save stay shared.
export function createBrowserHost(api, userAgent = globalThis.navigator?.userAgent || '') {
  const manifest = api.runtime.getManifest();
  const firefox = Boolean(manifest.browser_specific_settings?.gecko);
  const popup = manifest.action?.default_popup === 'sidepanel.html';
  const name = popup ? 'safari' : firefox ? 'firefox' : /Edg\//.test(userAgent) ? 'edge' : 'chrome';
  return {
    name,
    open: windowId => popup ? Promise.resolve() : firefox ? api.sidebarAction.open() : api.sidePanel.open({ windowId }),
    close: windowId => popup ? Promise.resolve() : firefox ? api.sidebarAction.close() : api.sidePanel.close({ windowId }),
    onClosed: popup || firefox ? undefined : api.sidePanel.onClosed,
  };
}
export const extensionApi = globalThis.browser ?? globalThis.chrome;
