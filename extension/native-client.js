// A fresh, bounded browser-owned process for each request. Never replay a write
// through another transport after an uncertain response.
const hosts = ['app.stashdock.desktop', 'app.stashdock.plugin'];
export function createNativeClient(runtime = (globalThis.browser ?? globalThis.chrome)?.runtime) {
  const available = typeof runtime?.connectNative === 'function';
  function at(host, path, body) {
    if (!available || !hosts.includes(host)) return Promise.reject(Object.assign(Error('The local save component is unavailable.'), { transport:true }));
    return new Promise((resolve, reject) => {
      let port, settled = false;
      const finish = (error, value) => {
        if (settled) return; settled = true; clearTimeout(timer);
        try { port?.disconnect(); } catch { /* Already disconnected. */ }
        error ? reject(error) : resolve(value);
      };
      const timer = setTimeout(() => finish(Object.assign(Error('The local save request timed out. Retry.'), {transport:true})), path==='/capture'?14000:6000);
      try {
        port = runtime.connectNative(host);
        port.onMessage.addListener(message => {
          if (message?.ok === true && message.value && typeof message.value === 'object') finish(null, message.value);
          else finish(Error(message?.error || 'The local save component returned an invalid response.'));
        });
        port.onDisconnect.addListener(() => {
          const message = runtime.lastError?.message || port.error?.message || 'The local save component disconnected.';
          // Reads may try the other installed product. The chosen write uses
          // at() directly and a crash/timeout can never replay that mutation.
          finish(Object.assign(Error(message), { transport:true }));
        });
        port.postMessage({path, ...(body === undefined ? {} : {body})});
      } catch (error) { finish(Object.assign(error, {transport:true})); }
    });
  }
  return {
    at: (base, path, body) => at(base.slice('native:'.length), path, body),
    query: async (path, body) => {
      if (!available) return null;
      for (const host of hosts) {
        try { return {base:'native:'+host, value:await at(host,path,body)}; }
        catch (error) { if (!error.transport) throw error; }
      }
      return null;
    },
  };
}
