import { createNativeClient } from './native-client.js';
// Bounded discovery of StashDock services only. No browser profile scanning,
// Cookie access, direct SQLite access or broad network permission.
export async function checkSetup({ fetcher = fetch, browser = 'chrome', timeout = 700, version = (globalThis.browser ?? globalThis.chrome)?.runtime?.getManifest?.()?.version || '0', extensionId = (globalThis.browser ?? globalThis.chrome)?.runtime?.id, native = createNativeClient() } = {}) {
  try {
    const local = await native.query('/setup', JSON.stringify({browser,version,extensionId}));
    if (local?.value.connected === true) return local.value;
  } catch (error) { return {connected:false,integrations:{items:[]},error:error.message}; }
  let compatible = null, failure = null;
  for (const port of [17864, 17863]) {
    try {
      const response = await fetcher(`http://127.0.0.1:${port}/v1/setup`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-StashDock-Client': 'chrome-extension-v1' }, body: JSON.stringify({ browser, version, ...(extensionId ? { extensionId } : {}) }), signal: AbortSignal.timeout(timeout) });
      let result; try { result = await response.json(); } catch { /* No diagnostic body. */ }
      if (response.ok && result?.connected === true && Array.isArray(result.integrations?.items)) return result;
      // Only a missing route is a legacy provider. A live service rejecting
      // registration is not an authenticated connection, even if healthy.
      if (response.status !== 404) {
        failure = { connected: false, integrations: { items: [] }, error: typeof result?.error === 'string' ? result.error : 'StashDock could not connect to this extension. Retry.' };
        continue;
      }
      // Older, compatible services still accept captures when setup is absent.
      const health = await fetcher(`http://127.0.0.1:${port}/v1/health`, { headers: { 'X-StashDock-Client': 'chrome-extension-v1' }, signal: AbortSignal.timeout(timeout) });
      if (health.ok) {
        const value = await health.json();
        if (value.ok === true && value.name === 'StashDock' || value.status === 'ready' && value.app === 'StashDock library') compatible ||= { connected: true, owner: port === 17864 ? 'codex' : 'desktop', integrations: { items: [] } };
      }
    } catch { /* Try the other known StashDock service, never another database. */ }
  }
  return compatible || failure || { connected: false, integrations: { items: [] } };
}

// One in-flight discovery. The sidebar's bounded RPC retry and visible-only
// checks recover failures; toolbar activation also retries after app startup.
export function createSetupConnection(options) {
  let flight;
  return () => flight ||= checkSetup(options).finally(() => { flight = undefined; });
}

// Connectivity checks do not re-register installations or scan integration
// metadata. Those belong to the toolbar/startup handshake, not a live form.
export async function checkProvider({ fetcher = fetch, timeout = 700, native = createNativeClient() } = {}) {
  try {
    const local = await native.query('/health');
    if (local?.value.ok === true && local.value.name === 'StashDock') return {connected:true};
  } catch (error) { return {connected:false,error:error.message}; }
  let error;
  for (const port of [17864, 17863]) {
    try {
      const response = await fetcher(`http://127.0.0.1:${port}/v1/health`, { headers: { 'X-StashDock-Client': 'chrome-extension-v1' }, signal: AbortSignal.timeout(timeout) });
      if (!response.ok) {
        try { const value = await response.json(); if(typeof value.error === 'string') error = value.error; } catch { /* Keep the last concrete provider error. */ }
        continue;
      }
      const value = await response.json();
      if ((value.ok === true && value.name === 'StashDock') || (value.status === 'ready' && value.app === 'StashDock library')) return { connected: true };
    } catch { /* The other provider may be running. */ }
  }
  return { connected: false, ...(error ? {error} : {}) };
}
