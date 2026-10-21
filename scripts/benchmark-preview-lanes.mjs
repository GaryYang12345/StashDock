// Isolated public-page comparison. No user URLs, library reads or writes.
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { createPreviewSession } from '../plugins/stashdock/server/preview-session.mjs';

const before=resolve(process.argv[2] || 'artifacts/preview-two-lanes-20261021/preview-before.exe');
const after=resolve(process.argv[3] || 'src-tauri/target/release/stashdock-preview.exe');
const urls=['https://example.org/','https://example.com/','https://example.net/'];
const faviconUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
async function measure(helper,parallel) {
  const sessions=Array.from({length:parallel},()=>createPreviewSession(helper));
  let next=0;const rows=[];const started=performance.now();
  try {
    await Promise.all(sessions.map(async session=>{
      while(next<urls.length) {
        const index=next++, start=performance.now();
        try {
          const result=await session.run({url:urls[index],needPreview:true,faviconUrl},undefined,{timeout:55_000});
          rows.push({index,ms:Math.round(performance.now()-start),screenshot:result.previewKind==='screenshot' && (result.preview?.length || 0)>1000});
        } catch(error) { rows.push({index,ms:Math.round(performance.now()-start),error:error.message}); }
      }
    }));
    return {parallel,ms:Math.round(performance.now()-started),rows:rows.sort((a,b)=>a.index-b.index)};
  } finally { await Promise.all(sessions.map(session=>session.close())); }
}
console.log(JSON.stringify({phase:'before',...await measure(before,1)}));
console.log(JSON.stringify({phase:'after',...await measure(after,2)}));
