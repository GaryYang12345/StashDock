// Bounded discovery of StashDock services only. No browser profile scanning,
// Cookie access, direct SQLite access or broad network permission.
export async function checkSetup({ fetcher = fetch, browser = 'chrome', version = (globalThis.browser ?? globalThis.chrome)?.runtime?.getManifest?.()?.version || '0', extensionId = (globalThis.browser ?? globalThis.chrome)?.runtime?.id } = {}) {
  let compatible = null;
  for (const port of [17864, 17863]) {
    try {
      const response = await fetcher(`http://127.0.0.1:${port}/v1/setup`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-StashDock-Client': 'chrome-extension-v1' }, body: JSON.stringify({ browser, version, ...(extensionId ? { extensionId } : {}) }), signal: AbortSignal.timeout(700) });
      if (response.ok) { const result = await response.json(); if (result.connected === true && Array.isArray(result.integrations?.items)) return result; }
      // Older, compatible services still accept captures. Do not call their
      // missing setup endpoint proof that StashDock is not installed.
      const health = await fetcher(`http://127.0.0.1:${port}/v1/health`, { headers: { 'X-StashDock-Client': 'chrome-extension-v1' }, signal: AbortSignal.timeout(700) });
      if (health.ok) {
        const value = await health.json();
        if (value.ok === true && value.name === 'StashDock' || value.status === 'ready' && value.app === 'StashDock library') compatible ||= { connected: true, owner: port === 17864 ? 'codex' : 'desktop', integrations: { items: [] } };
      }
    } catch { /* Try the other known StashDock service, never another database. */ }
  }
  return compatible || { connected: false, integrations: { items: [] } };
}

// One in-flight discovery. The sidebar's bounded RPC retry and visible-only
// checks recover failures; toolbar activation also retries after app startup.
export function createSetupConnection(options) {
  let flight;
  return () => flight ||= checkSetup(options).finally(() => { flight = undefined; });
}

// Connectivity checks do not re-register installations or scan integration
// metadata. Those belong to the toolbar/startup handshake, not a live form.
export async function checkProvider({ fetcher = fetch } = {}) {
  for (const port of [17864, 17863]) {
    try {
      const response = await fetcher(`http://127.0.0.1:${port}/v1/health`, { headers: { 'X-StashDock-Client': 'chrome-extension-v1' }, signal: AbortSignal.timeout(700) });
      if (!response.ok) continue;
      const value = await response.json();
      if ((value.ok === true && value.name === 'StashDock') || (value.status === 'ready' && value.app === 'StashDock library')) return { connected: true };
    } catch { /* The other provider may be running. */ }
  }
  return { connected: false };
}
