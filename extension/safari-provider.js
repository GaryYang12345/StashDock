// Compatibility for already-open older Safari popups and retained operations.
// The current native handler maps this wire format to the same XPC/Rust owner;
// it no longer opens an HTTP connection. New saves use safari-native.js.
export function createSafariFetcher(api) {
  return async (input, options = {}) => {
    const url = new URL(input);
    const method = options.method || 'GET';
    if (url.hostname !== '127.0.0.1' || !['17863', '17864'].includes(url.port) || url.protocol !== 'http:' ||
        url.username || url.password || url.hash) throw Error('Invalid StashDock provider.');
    const path = url.pathname + url.search;
    const allowed = method === 'GET' ? ['/v1/health', '/v1/tags'].includes(path) || url.pathname === '/v1/capture'
      : method === 'POST' && ['/v1/setup', '/v1/capture', '/v1/tags', '/v1/capture/lookup'].includes(path);
    if (!allowed || typeof (options.body || '') !== 'string' || new TextEncoder().encode(options.body || '').length > 1_000_000) throw Error('Invalid StashDock request.');
    if (options.signal?.aborted) throw Error('StashDock request cancelled.');
    const request = api.runtime.sendNativeMessage('app.stashdock.desktop', { method, path, body: options.body || '', port: Number(url.port) });
    const result = await new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); };
      const abort = () => { cleanup(); reject(Error('StashDock request cancelled.')); };
      const timer = setTimeout(() => { cleanup(); reject(Error('StashDock request timed out.')); }, 5500);
      options.signal?.addEventListener('abort', abort, { once: true });
      Promise.resolve(request).then(resolve, reject).finally(cleanup);
    });
    if (!result || !Number.isInteger(result.status) || result.status < 100 || result.status > 599 || typeof result.body !== 'string') {
      throw Error('The StashDock native provider returned no response.');
    }
    return new Response([204, 205, 304].includes(result.status) ? null : result.body, { status: result.status, headers: { 'Content-Type': 'application/json' } });
  };
}
