import { firefoxNativeHost } from './ui/native-host.js';

// Browser-owned native messaging verifies the caller. No profile access and no
// caller-selected executable, host or Origin reaches the native adapter.
export function createFirefoxFetcher(api) {
  const unavailable = message => new Response(JSON.stringify({error:message}),{status:503,headers:{'Content-Type':'application/json'}});
  return async (input, options = {}) => {
    const url = new URL(input), method = options.method || 'GET', path = url.pathname;
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !['17863','17864'].includes(url.port) ||
        url.username || url.password || url.hash || url.search ||
        !(method === 'GET' && path === '/v1/health' || method === 'POST' && ['/v1/setup','/v1/capture','/v1/tags','/v1/capture/lookup'].includes(path)) ||
        typeof (options.body || '') !== 'string' || new TextEncoder().encode(options.body || '').length > 1_000_000) throw Error('Invalid StashDock request.');
    if (options.signal?.aborted) throw Error('StashDock request cancelled.');
    if (!await api.permissions.contains({permissions:['nativeMessaging']})) return unavailable('Click StashDock in the Firefox toolbar and allow its connection to the local app, then retry.');
    if (options.signal?.aborted) throw Error('StashDock request cancelled.');
    let result;
    try {
      result = await new Promise((resolve,reject) => {
        const cleanup = () => { clearTimeout(timer); options.signal?.removeEventListener('abort',abort); };
        const abort = () => { cleanup(); reject(Error('StashDock request cancelled.')); };
        const timer = setTimeout(() => { cleanup(); reject(Error('StashDock request timed out.')); },5500);
        options.signal?.addEventListener('abort',abort,{once:true});
        Promise.resolve().then(() => {
          if (options.signal?.aborted) throw Error('StashDock request cancelled.');
          return api.runtime.sendNativeMessage(firefoxNativeHost,{method,path,body:options.body || '',port:Number(url.port)});
        })
          .then(resolve,reject).finally(cleanup);
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      return unavailable('Open the latest StashDock Desktop or its AI plugin, then retry.');
    }
    if (!result || !Number.isInteger(result.status) || result.status < 100 || result.status > 599 || typeof result.body !== 'string') throw Error('The StashDock native provider returned no response.');
    return new Response([204,205,304].includes(result.status) ? null : result.body,{status:result.status,headers:{'Content-Type':'application/json'}});
  };
}
