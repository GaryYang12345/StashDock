// Runs inside an owned extension, using the production native/library clients.
// mutate() changes only nonce-scoped fixture manifests/files outside the browser.
export async function runNativeRecovery({createNativeClient, createBrowserLibrary, runtime, storage, mutate, suffix, marker}) {
  const attempts=[];
  const native=createNativeClient({get lastError(){return runtime.lastError;},connectNative:host=>{
    attempts.push(host);
    return runtime.connectNative(host+'.'+suffix+'.both');
  }});
  const initial=await native.query('/tags');
  if(!initial?.value.tags?.includes(marker))throw Error('Recovery fixture isolation was not confirmed.');
  const reports=[];
  for(const [phase,provider] of [
    ['desktop-missing','plugin'],['desktop-restored','desktop'],
    ['desktop-upgraded','desktop'],['desktop-uninstalled','plugin'],
    ['desktop-reinstalled','desktop'],['library-moved','desktop'],
    ['library-unavailable',null],['library-restored','desktop'],
  ]) {
    await mutate(phase);attempts.length=0;
    let result,error;
    try{result=await native.query('/tags');}catch(failure){error=failure;}
    if(provider) {
      if(error)throw error;
      if(result?.base!=='native:app.stashdock.'+provider||!result.value.tags?.includes(marker))throw Error('Unexpected provider/library after '+phase);
    } else if(!error||error.transport||!/unavailable/i.test(error.message)||attempts.length!==1) {
      throw Error('An unavailable library must report a business error without selecting another provider: '+JSON.stringify({result,error:error?.message,attempts}));
    }
    reports.push({phase,provider:result?.base??null,attempts:[...attempts],...(error?{error:error.message}:{})});
  }
  let httpCalls=0;
  const library=createBrowserLibrary({native,storage,fetcher:()=>{httpCalls++;throw Error('HTTP provider forbidden');}});
  const item={id:'draft',kind:'web',title:'Save after native recovery',source:'Example',url:'https://example.org/native-recovery/'+suffix,content:'Saved after helper upgrade and library reconnect.',excerpt:'',tags:['Native acceptance'],createdAt:new Date().toISOString(),favorite:false};
  const operationId=crypto.randomUUID();
  const saved=await library.save(item,{operationId});
  const retry=await library.save(item,{operationId});
  if(saved.saved!==true||retry.id!==saved.id||httpCalls)throw Error('Recovery save/retry was not confirmed.');
  return {reports,saved,retry,httpCalls,operation:{item,operationId}};
}

export async function verifyNativeRestart({createNativeClient,createBrowserLibrary,runtime,storage,suffix,marker,operation}) {
  const native=createNativeClient({get lastError(){return runtime.lastError;},connectNative:host=>runtime.connectNative(host+'.'+suffix+'.both')});
  const scope=await native.query('/tags');
  if(scope?.base!=='native:app.stashdock.desktop'||!scope.value.tags?.includes(marker))throw Error('Restart did not resolve the upgraded helper and moved library.');
  let httpCalls=0;
  const library=createBrowserLibrary({native,storage,fetcher:()=>{httpCalls++;throw Error('HTTP provider forbidden');}});
  const receipt=await library.save(operation.item,{operationId:operation.operationId});
  if(receipt.saved!==true||httpCalls)throw Error('The durable receipt was not recovered after browser restart.');
  return {provider:scope.base,receipt,httpCalls};
}
