// Only browser-owned sidebar APIs differ. Capture, RPC and Save stay shared.
export function createBrowserHost(api, userAgent = globalThis.navigator?.userAgent || '') {
  const firefox = Boolean(api.runtime.getManifest().browser_specific_settings?.gecko);
  const name = firefox ? 'firefox' : /Edg\//.test(userAgent) ? 'edge' : 'chrome';
  return {
    name,
    open: windowId => firefox ? api.sidebarAction.open() : api.sidePanel.open({ windowId }),
    close: windowId => firefox ? api.sidebarAction.close() : api.sidePanel.close({ windowId }),
    onClosed: firefox ? undefined : api.sidePanel.onClosed,
  };
}
export const extensionApi = globalThis.browser ?? globalThis.chrome;
