import { createNativeClient } from './native-client.js';
// Save-only client. Keep tag names and unfinished legacy operations, never a shelf.
export function createBrowserLibrary({ storage, fetcher = fetch, locks = globalThis.navigator?.locks, setup, native = createNativeClient() }) {
  const key = 'stashdock-library-v1';
  let chain = Promise.resolve();
  const serial = callback => {
    const transaction = () => locks ? locks.request(key, callback) : callback();
    const next = chain.then(transaction, transaction); chain = next.catch(() => {}); return next;
  };
  async function read() {
    const previous = (await storage.get(key))[key] || {};
    const data = { knownTags: previous.knownTags || [], imports: previous.imports || [], deletes: previous.deletes || [], edits: previous.edits || [] };
    if ('items' in previous) await storage.set({ [key]: data });
    return data;
  }
  const write = data => storage.set({ [key]: data });
  async function at(base, path, options = {}, retrySetup = true) {
    if (base.startsWith('native:')) return native.at(base, path, options.body);
    const response = await fetcher(`${base}/v1${path}`, { ...options, signal: AbortSignal.timeout(1800), headers: { 'Content-Type': 'application/json', 'X-StashDock-Client': 'chrome-extension-v1' } });
    let payload; try { payload = await response.json(); } catch { payload = {}; }
    if (response.status === 403 && retrySetup && setup) {
      const status = await setup();
      if (status?.connected) return at(base, path, options, false);
      if (typeof status?.error === 'string') {
        const error = Error(status.error); error.status = response.status; throw error;
      }
    }
    if (!response.ok) {
      const error=Error(response.status===404 ? 'Update StashDock Desktop or its AI plugin, then retry.' : payload.error || 'The page could not be saved. Retry.');
      error.status=response.status; throw error;
    }
    return payload;
  }
  async function query(path, options, useNative = true) {
    const local = useNative && await native.query(path, options?.body);
    if (local) return local;
    let failure;
    for (const port of [17864,17863]) {
      const base = `http://127.0.0.1:${port}`;
      try { return { base, value: await at(base,path,options) }; } catch(error) { if(error.status && (!failure || error.status!==404)) failure=error; }
    }
    throw failure || Error('Install the latest StashDock Desktop or AI plugin, then retry.');
  }
  // Extension GET/HEAD requests may omit Origin despite host permissions.
  // JSON POST preserves browser-supplied origin authentication for read RPCs.
  const lookup = (url, options={}, useNative=true) => query('/capture/lookup',{method:'POST',body:JSON.stringify({url,...options})},useNative);
  return {
    tags: () => serial(async () => {
      const data = await read();
      try { const { value } = await query('/tags',{method:'POST',body:'{}'}); if (Array.isArray(value.tags)) data.knownTags = value.tags; } catch { /* Keep the last tag names for offline editing. */ }
      await write(data); return data.knownTags;
    }),
    save: (item, options) => serial(async () => {
      await read(); // Remove the retired whole-library cache on first use.
      const body=JSON.stringify({item,...options});
      const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body));
      const digest=[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
      const { base, value } = await lookup(item.url,{operationId:options.operationId,digest});
      if(value.saved)return value;
      if (!options.replace && value.duplicate) return value;
      // One mutation attempt. A retry uses the same operation ID; providers share
      // a bounded receipt so an uncertain response cannot overwrite twice.
      return at(base, '/capture', { method:'POST', body });
    }),
    recoverPending: () => serial(async () => {
      const data = await read();
      const pending = () => data.imports.length + data.deletes.length + data.edits.length;
      if (!pending()) return;
      // Recovery only, not an active editor/shelf API. Preserve unfinished user
      // operations from older releases without downloading or caching the shelf.
      try {
        for (const type of ['deletes','imports','edits']) while(data[type].length) {
          const entry = data[type][0];
          const url = type === 'imports' ? entry.url : typeof entry === 'object' && entry.url;
          const {base,value} = url ? await lookup(url,{},false) : await query('/health',undefined,false);
          const id = url ? value.duplicate?.id : typeof entry === 'string' ? entry : entry.id;
          if (type === 'imports') {
            const result = await at(base,'/import',{method:'POST',body:JSON.stringify({items:[entry]})});
            if (result.total !== 1 || result.imported + result.updated + result.skipped !== 1) throw Error('The save was not confirmed.');
          } else if (id) await at(base,'/items/'+encodeURIComponent(id),type === 'deletes' ? {method:'DELETE'} : {method:'PATCH',body:JSON.stringify(entry.patch)});
          else if(type==='edits') throw Error('The reference is no longer available.');
          data[type].shift(); await write(data);
        }
        return { connected:true, pending:0 };
      } catch(error) { return { connected:false, pending:pending(), error:error.message }; }
    }),
  };
}
