// Real, isolated image-queue smoke test. Never reads or changes the user's library.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { packagedPreviewService, startPreviewWorker } from '../plugins/stashdock/server/preview-worker.mjs';

const directory=await mkdtemp(join(tmpdir(),'stashdock-image-lanes-'));
const library=createLocalLibrary({dataDir:directory});
const html=new URL('../plugins/stashdock/web/shelf.html',import.meta.url);
const service=packagedPreviewService(html,directory);
const icon='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const started=Date.now();
const worker=startPreviewWorker(directory,html,service);
const db=new DatabaseSync(join(directory,'stashdock.sqlite3'));
try {
  library.importItems(['https://example.org/','https://example.com/','https://stashdock-test.invalid/'].map(url=>({title:'Isolated screenshot test',kind:'web',url,source:'Fixture',content:'Preserve this body',tags:[],origin:{importMethod:'manual_url',contentSettled:true,faviconUrl:icon}})));
  const until=Date.now()+120_000;
  let jobs=[];
  do {
    await new Promise(resolve=>setTimeout(resolve,100));
    jobs=db.prepare('SELECT status,attempts FROM web_preview_jobs').all();
  } while ((jobs.length!==3 || jobs.some(job=>!['done','failed'].includes(job.status))) && Date.now()<until);
  assert.equal(jobs.length,3);
  assert.ok(jobs.every(job=>['done','failed'].includes(job.status)),'Every task must settle');
  const rows=await library.read();
  const failed=rows.find(row=>row.url.includes('.invalid'));
  assert.equal(failed.previewStatus,'failed');assert.ok(!failed.preview);
  assert.equal(jobs.filter(job=>job.status==='failed' && job.attempts===2).length,1);
  assert.equal(rows.filter(row=>row.preview && row.origin.previewKind==='screenshot').length,2);
  assert.ok(rows.every(row=>row.content==='Preserve this body'));
  console.log(JSON.stringify({milliseconds:Date.now()-started,screenshots:2,failedWithDefaultCover:1,failedAttempts:2,bodyPreserved:true,jobs}));
} finally {
  await worker.close();await service.close();db.close();library.close();
  await rm(directory,{recursive:true,force:true});
}
