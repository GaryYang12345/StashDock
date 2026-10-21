import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { previewQueue, startPreviewWorker } from '../plugins/stashdock/server/preview-worker.mjs';

test('two image lanes claim distinct jobs and retry a failure immediately once', async () => {
  const dir=mkdtempSync(join(tmpdir(),'stashdock-two-lanes-'));
  const library=createLocalLibrary({dataDir:dir});
  for(let i=0;i<4;i++) library.importItems([{title:`Item ${i}`,kind:'web',url:`https://example.org/${i}`,source:'S',tags:[],content:'Keep content',origin:{importMethod:'manual_url',contentSettled:true}}]);
  const calls=new Map(); let active=0,peak=0;
  const worker=startPreviewWorker(dir,new URL('../plugins/stashdock/web/shelf.html',import.meta.url),{
    capture:async (job,signal) => {
      const count=(calls.get(job.id)||0)+1; calls.set(job.id,count);
      active++;peak=Math.max(peak,active);
      try { await new Promise(resolve=>setTimeout(resolve,15)); return job.url.endsWith('/0') ? {} : {preview:'data:image/png;base64,YQ==',previewKind:'screenshot',faviconUrl:'data:image/png;base64,YQ=='}; }
      finally { active--; }
    }, content:async()=>({}),
  },{hasHelper:()=>true});
  try {
    const until=Date.now()+1500;
    while((calls.size<4 || active || [...calls.values()].reduce((a,b)=>a+b,0)<5) && Date.now()<until) await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(peak,2); assert.equal(calls.size,4); assert.deepEqual([...calls.values()].sort(),[1,1,1,2]);
    assert.equal((await library.read()).filter(row=>row.preview).length,3);
  } finally { await worker.close(); library.close();rmSync(dir,{recursive:true,force:true}); }
});

test('expired tasks leave loading and stale first-attempt results cannot overwrite a retry', async () => {
  const dir=mkdtempSync(join(tmpdir(),'stashdock-task-expiry-'));
  const library=createLocalLibrary({dataDir:dir}); let time=100;
  const queue=previewQueue(dir,{owner:'worker',now:()=>time}), db=new DatabaseSync(join(dir,'stashdock.sqlite3'));
  try {
    library.importItems([{title:'Expired',kind:'web',url:'https://example.org/',source:'S',tags:[]}]);
    queue.renew();const first=queue.claim();time+=61;queue.renew();const second=queue.claim();
    assert.equal(second.attempts,2); assert.equal(queue.publish(first,{preview:'data:image/png;base64,YQ==',previewKind:'screenshot'}),false);
    time+=61;queue.renew();assert.equal(queue.claim(),null);
    assert.equal(db.prepare('SELECT status FROM web_preview_jobs').get().status,'failed');
    assert.equal(queue.finish(second,{preview:'data:image/png;base64,YQ==',previewKind:'screenshot'}),false);
  } finally { queue.close();db.close();library.close();rmSync(dir,{recursive:true,force:true}); }
});

test('closing hands an unfinished screenshot back without spending an attempt (same rule as Desktop)', async () => {
  const dir=mkdtempSync(join(tmpdir(),'stashdock-quit-'));
  const library=createLocalLibrary({dataDir:dir}); const time=100;
  const queue=previewQueue(dir,{owner:'quitting',now:()=>time}), db=new DatabaseSync(join(dir,'stashdock.sqlite3'));
  try {
    library.importItems([{title:'Interrupted',kind:'web',url:'https://example.org/',source:'S',tags:[]}]);
    queue.renew(); const job=queue.claim(); assert.equal(job.attempts,1);
    queue.close();
    assert.deepEqual({...db.prepare('SELECT status,attempts FROM web_preview_jobs').get()},{status:'queued',attempts:0});
    assert.equal(db.prepare("SELECT count(*) AS n FROM app_meta WHERE key='web_preview_worker_owner'").get().n,0);
    const next=previewQueue(dir,{owner:'next',now:()=>time});
    try { next.renew(); assert.equal(next.claim().attempts,1,'the next owner retries it as a first attempt'); } finally { next.close(); }
  } finally { db.close();library.close();rmSync(dir,{recursive:true,force:true}); }
});

test('existing screenshots still receive favicon enrichment without rendering again', async t => {
  const dir=mkdtempSync(join(tmpdir(),'stashdock-icon-'));
  const library=createLocalLibrary({dataDir:dir});
  const q=previewQueue(dir,{owner:'icons',now:()=>100});
  try {
    const item=library.importItems([{title:'Screenshot already saved',kind:'web',url:'https://example.org/',source:'S',excerpt:'',tags:[],preview:'data:image/jpeg;base64,YQ=='}]).items[0];
    q.renew(); const job=q.claim(); assert.equal(job.id,item.id); assert.equal(job.needsPreview,false);
    q.finish(job,{faviconUrl:'data:image/png;base64,YQ=='});
    const row=(await library.read())[0]; assert.equal(row.preview,item.preview); assert.equal(row.origin.faviconUrl,'data:image/png;base64,YQ=='); assert.equal(q.claim(),null);
  } finally { q.close(); library.close(); rmSync(dir,{recursive:true,force:true}); }
});

test('missing covers are processed before icon-only maintenance in a bulk import', t => {
  const dir = mkdtempSync(join(tmpdir(), 'stashdock-preview-priority-'));
  const library = createLocalLibrary({ dataDir: dir });
  const queue = previewQueue(dir, { owner: 'priority', now: () => 100 });
  try {
    const older = library.importItems([{ title: 'Missing screenshot', kind: 'web', source: 'S', url: 'https://example.org/older', tags: [], createdAt: '2026-01-01' }]).items[0];
    library.importItems([{ title: 'Only needs an icon', kind: 'web', source: 'S', url: 'https://example.org/newer', tags: [], createdAt: '2026-10-20', preview: 'data:image/jpeg;base64,YQ==' }]);
    queue.renew(); assert.equal(queue.claim().id, older.id);
  } finally { queue.close(); library.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('idle lease checks and empty queue probes neither write nor require a writer lock', t => {
  const dir = mkdtempSync(join(tmpdir(), 'stashdock-worker-idle-'));
  const library = createLocalLibrary({ dataDir: dir });
  let time = 100;
  const q = previewQueue(dir, { owner: 'idle', now: () => time });
  const other = new DatabaseSync(join(dir, 'stashdock.sqlite3'));
  try {
    q.renew(); assert.equal(q.claim(), null);
    const version = () => other.prepare('PRAGMA data_version').get().data_version;
    const before = version();
    for (let i = 0; i < 20; i++) { assert.ok(q.renew()); assert.equal(q.claim(), null); }
    assert.equal(version(), before);
    other.exec('BEGIN IMMEDIATE');
    try { assert.ok(q.renew()); assert.equal(q.claim(), null); }
    finally { other.exec('ROLLBACK'); }
    time += 31; assert.ok(q.renew()); assert.notEqual(version(), before);
    library.importItems([{ title: 'New work', kind: 'web', source: 'Source', url: 'https://example.org/new', tags: [] }]);
    assert.ok(q.claim(), 'A different connection invalidates the empty probe without waiting 15s');
  } finally { q.close(); other.close(); library.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('preview queue has one owner, survives failure, preserves edits and rejects stale completion', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'stashdock-worker-'));
  const library = createLocalLibrary({ dataDir: dir }); t.after(() => library.close());
  const db = new DatabaseSync(join(dir, 'stashdock.sqlite3')); t.after(() => db.close());
  const item = library.importItems([{ title:'Keep title',kind:'web',url:'https://example.org/',source:'Source',excerpt:'Excerpt',content:'Actual content',tags:['Keep tag'],favorite:true }]).items[0];
  let time = 1000;
  const a = previewQueue(dir, {now:()=>time,owner:'A'}), b = previewQueue(dir, {now:()=>time,owner:'B'});
  t.after(() => { a.close(); b.close(); });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.ok(a.renew()); assert.equal(b.renew(), false); assert.equal(b.claim(), null);
  const job = a.claim(); assert.equal(job.id,item.id); assert.equal(a.claim(),null);
  time += 91; assert.ok(b.renew()); assert.equal(a.finish(job, {preview:'data:image/jpeg;base64,YQ==',previewKind:'screenshot'}),false);
  const claimed = b.claim();
  library.editMetadata(item.id,'Edited title',['New tag']); library.editContext(item.id,'Edited AI context');
  assert.ok(b.finish(claimed,{preview:'data:image/jpeg;base64,YQ==',previewKind:'screenshot',faviconUrl:'data:image/png;base64,YQ=='}));
  const saved = (await library.read())[0]; assert.equal(saved.title,'Edited title'); assert.equal(saved.content,'Actual content'); assert.equal(saved.contextOverride,'Edited AI context'); assert.deepEqual(saved.tags,['New tag']); assert.equal(saved.favorite,true); assert.equal(saved.origin.previewKind,'screenshot');
  a.close(); assert.equal(db.prepare("SELECT value FROM app_meta WHERE key='web_preview_worker_owner'").get().value,'B');
  const deleted = library.importItems([{title:'Delete',kind:'web',url:'https://example.org/delete',source:'S',excerpt:'',tags:[]}]).items[0];
  const stale = b.claim(); assert.equal(stale.id,deleted.id); library.remove(deleted.id); assert.equal(b.finish(stale,{preview:'data:image/png;base64,YQ==',previewKind:'cover'}),false);
  assert.equal((await library.read()).length,1);
});
test('preview queue retries immediately once, then stops permanently without cooldown', t => {
  const dir = mkdtempSync(join(tmpdir(), 'stashdock-worker-'));
  const library=createLocalLibrary({dataDir:dir}); t.after(()=>library.close());
  library.importItems([{title:'Failed',kind:'web',url:'https://example.org',source:'S',excerpt:'',tags:[]}]);
  const db=new DatabaseSync(join(dir,'stashdock.sqlite3')); t.after(()=>db.close()); let time=100;
  db.prepare("INSERT INTO app_meta VALUES('web_preview_worker_until','190')").run();
  const q=previewQueue(dir,{now:()=>time,owner:'worker'}); t.after(()=>q.close()); assert.equal(q.renew(),false);
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  time=191;
  for(let i=0;i<2;i++){ assert.ok(q.renew()); const job=q.claim(); assert.ok(job); q.finish(job,{}); }
  assert.equal(db.prepare('SELECT status FROM web_preview_jobs').get().status,'failed');
  time+=3600; q.renew(); assert.equal(q.claim(),null); assert.equal(db.prepare('SELECT attempts FROM web_preview_jobs').get().attempts,2);
});
test('a new renderer version retries exhausted failures once, not on every launch', t => {
  const dir=mkdtempSync(join(tmpdir(),'stashdock-upgrade-'));
  const library=createLocalLibrary({dataDir:dir});
  const item=library.importItems([{title:'Retry',kind:'web',url:'https://example.org/',source:'S',excerpt:'',tags:[]}]).items[0];
  const db=new DatabaseSync(join(dir,'stashdock.sqlite3'));
  let q=previewQueue(dir,{now:()=>100,owner:'old',version:'old'}); q.renew(); q.finish(q.claim(),{}); q.close();
  db.exec("UPDATE web_preview_jobs SET attempts=3,retry_at=1000,status='failed'");
  q=previewQueue(dir,{now:()=>100,owner:'new',version:'new'});
  try {
    assert.ok(q.renew()); assert.equal(db.prepare('SELECT attempts FROM web_preview_jobs').get().attempts,0);
    const job=q.claim(); assert.ok(job); q.finish(job,{});
    q.renew(); assert.equal(db.prepare('SELECT attempts FROM web_preview_jobs').get().attempts,1); assert.ok(q.claim()); assert.equal(q.claim(),null);
  } finally { q.close(); db.close(); library.close(); rmSync(dir,{recursive:true,force:true}); }
});

test('early screenshot is visible while icons are pending, and late results preserve a chosen cover', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'stashdock-preview-progress-'));
  const library = createLocalLibrary({ dataDir: dir }), queue = previewQueue(dir, { owner: 'progress', now: () => 100 });
  const db = new DatabaseSync(join(dir, 'stashdock.sqlite3'));
  try {
    const item = library.importItems([{ title: 'Progress', kind: 'web', source: 'S', url: 'https://example.org/', tags: [] }]).items[0];
    queue.renew(); const job = queue.claim();
    const image = { preview: 'data:image/jpeg;base64,YQ==', previewKind: 'screenshot' };
    assert.equal(queue.publish(job, image), true);
    assert.equal((await library.read())[0].preview, image.preview);
    assert.equal(db.prepare('SELECT status FROM web_preview_jobs').get().status, 'working');
    queue.finish(job, { ...image, faviconUrl: 'data:image/png;base64,YQ==' });
    assert.equal(db.prepare('SELECT status FROM web_preview_jobs').get().status, 'done');
    db.prepare('UPDATE stash_items SET preview=?,origin_json=? WHERE id=?').run('data:image/jpeg;base64,Yg==', '{"previewKind":"cover","previewSource":"custom"}', item.id);
    queue.publish(job, image);
    assert.equal((await library.read())[0].preview, 'data:image/jpeg;base64,Yg==');
    assert.equal((await library.read())[0].origin.previewKind, 'cover');
  } finally { queue.close(); db.close(); library.close(); rmSync(dir, { recursive: true, force: true }); }
});
