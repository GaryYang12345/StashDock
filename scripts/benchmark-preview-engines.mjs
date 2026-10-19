// Isolated public page capture. Never touches normal browser profiles or the library.
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { runPreviewHelper } from '../plugins/stashdock/server/preview-worker.mjs';
const helper=resolve('src-tauri/target/release/stashdock-preview.exe');
for(let round=0;round<3;round++) {
  const started=performance.now();
  try { const data=await runPreviewHelper(helper,{url:'https://example.org/'}); console.log(JSON.stringify({name:'System WebView2',round,milliseconds:Math.round(performance.now()-started),hasImage:Boolean(data.preview),hasFavicon:Boolean(data.faviconUrl),error:data.error})); }
  catch(error) { console.log(JSON.stringify({name:'System WebView2',round,milliseconds:Math.round(performance.now()-started),error:error.message})); }
}
