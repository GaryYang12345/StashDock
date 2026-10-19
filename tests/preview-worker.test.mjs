import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { previewQueue } from '../plugins/stashdock/server/preview-worker.mjs';

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
  a.finish(job, {}); assert.equal(db.prepare('SELECT status FROM web_preview_jobs').get().status,'failed');
  assert.equal(a.claim(),null); time += 601; a.renew(); assert.ok(a.claim());
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
test('preview queue respects older native leases and does not load forever after three failures', t => {
  const dir = mkdtempSync(join(tmpdir(), 'stashdock-worker-'));
  const library=createLocalLibrary({dataDir:dir}); t.after(()=>library.close());
  library.importItems([{title:'Failed',kind:'web',url:'https://example.org',source:'S',excerpt:'',tags:[]}]);
  const db=new DatabaseSync(join(dir,'stashdock.sqlite3')); t.after(()=>db.close()); let time=100;
  db.prepare("INSERT INTO app_meta VALUES('web_preview_worker_until','190')").run();
  const q=previewQueue(dir,{now:()=>time,owner:'worker'}); t.after(()=>q.close()); assert.equal(q.renew(),false);
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  time=191;
  for(let i=0;i<3;i++){ assert.ok(q.renew()); const job=q.claim(); assert.ok(job); q.finish(job,{}); time+=601; }
  q.renew(); assert.equal(q.claim(),null); assert.equal(db.prepare('SELECT attempts FROM web_preview_jobs').get().attempts,3);
});
test('a new renderer version retries exhausted failures once, not on every launch', t => {
  const dir=mkdtempSync(join(tmpdir(),'stashdock-upgrade-'));
  const library=createLocalLibrary({dataDir:dir});
  const item=library.importItems([{title:'Retry',kind:'web',url:'https://example.org/',source:'S',excerpt:'',tags:[]}]).items[0];
  const db=new DatabaseSync(join(dir,'stashdock.sqlite3'));
  let q=previewQueue(dir,{now:()=>100,owner:'old',version:'old'}); q.renew(); q.claim(); q.finish({id:item.id,url:item.url},{}); q.close();
  db.exec("UPDATE web_preview_jobs SET attempts=3,retry_at=1000");
  q=previewQueue(dir,{now:()=>100,owner:'new',version:'new'});
  try {
    assert.ok(q.renew()); assert.equal(db.prepare('SELECT attempts FROM web_preview_jobs').get().attempts,0);
    const job=q.claim(); assert.ok(job); q.finish(job,{});
    q.renew(); assert.equal(db.prepare('SELECT attempts FROM web_preview_jobs').get().attempts,1); assert.equal(q.claim(),null);
  } finally { q.close(); db.close(); library.close(); rmSync(dir,{recursive:true,force:true}); }
});
