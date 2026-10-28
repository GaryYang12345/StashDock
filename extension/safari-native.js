// Safari's containing extension owns one signed, on-demand XPC service. No
// app window, HTTP service, caller-selected executable or second library.
const base = 'native:app.stashdock.safari';
const paths = new Set(['/health','/setup','/tags','/capture/lookup','/capture']);
export function createSafariNativeClient(runtime) {
  function request(path, body) {
    if (!paths.has(path) || (body !== undefined && typeof body !== 'string')) return Promise.reject(Error('Invalid StashDock native request.'));
    const packet = {path,...(body === undefined ? {} : {body})};
    if (new TextEncoder().encode(JSON.stringify(packet)).length > 1_000_000) return Promise.reject(Error('The StashDock request is too large.'));
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
      const timer=setTimeout(()=>finish(Error('The local save request timed out. Retry.')),path==='/capture'?14000:6000);
      try {
        Promise.resolve(runtime.sendNativeMessage('app.stashdock.desktop',packet)).then(result=>{
          if(result?.ok===true && result.value && typeof result.value==='object' && !Array.isArray(result.value))finish(null,result.value);
          else finish(Error(result?.error || 'Restart Safari to finish updating StashDock, then retry.'));
        },error=>finish(error));
      } catch(error){finish(error);}
    });
  }
  return {
    query: async(path,body)=>({base,value:await request(path,body)}),
    at: (selected,path,body)=>selected===base?request(path,body):Promise.reject(Error('Invalid StashDock native provider.')),
  };
}
