import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { createContentQueue } from '../plugins/stashdock/server/content-queue.mjs';
const row = (url, extra={}) => ({title:'Bookmark title',kind:'web',source:'Chrome',url,excerpt:'',tags:['Chrome'],createdAt:'2026-10-20T00:00:00Z',origin:{platform:'Chrome',importMethod:'browser_bookmarks',importedAt:'2026-10-20'},...extra});
function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'stashdock-content-test-'));
  const library=createLocalLibrary({dataDir:root}), db=new DatabaseSync(join(root,'stashdock.sqlite3'));
  db.prepare("INSERT INTO app_meta VALUES('web_content_worker_owner','test')").run();
  db.prepare("INSERT INTO app_meta VALUES('web_content_worker_until','1000')").run();
  const queue=createContentQueue(root,'test',{now:()=>100});
  t.after(()=>{queue.close();db.close();library.close();assert.ok(root.startsWith(join(tmpdir(),'stashdock-content-test-')));rmSync(root,{recursive:true,force:true});});
  return {library,db,queue};
}
test('bookmark content enrichment preserves metadata and commits the full-text index together',async t=>{
  const {library,db,queue}=fixture(t);
  const [item]=library.importItems([row('https://example.org')]).items;
  const job=queue.claim();assert.equal(job.id,item.id);
  assert.equal(queue.finish(job,{content:'Complete article body'}),true);
  const saved=(await library.readItems([item.id]))[0];
  assert.equal(saved.title,'Bookmark title');assert.deepEqual(saved.tags,['Chrome']);assert.equal(saved.content,'Complete article body');
  assert.equal(db.prepare("SELECT count(*) n FROM stash_fts WHERE stash_fts MATCH 'article'").get().n,1);
  assert.equal(queue.claim(),null);
});
test('new text tasks precede retries; both bookmark and manual empty links are eligible',t=>{
  const {library,db,queue}=fixture(t);
  const [a,b]=library.importItems([row('https://example.org/a',{createdAt:'2026-10-21'}),row('https://example.org/b'),row('https://example.org/manual',{createdAt:'2026-10-19',origin:{importMethod:'manual_url'}}),row('https://example.org/ready',{content:'Already read'})]).items;
  const first=queue.claim();assert.equal(first.id,a.id);queue.finish(first,{});
  db.prepare('UPDATE web_content_jobs SET retry_at=0').run();
  assert.equal(queue.claim().id,b.id);
  assert.ok(queue.claim(),'Manual URL must also be scheduled');
});
test('late content cannot overwrite edits, final context, a changed URL, or a deleted card',t=>{
  const {library,db,queue}=fixture(t);
  for(const field of ['content','context_override','url','delete']){
    const [item]=library.importItems([row('https://example.org/'+field)]).items;
    const job=queue.claim();assert.equal(job.id,item.id);
    if(field==='delete')library.remove(item.id);
    else db.prepare(`UPDATE stash_items SET ${field}=? WHERE id=?`).run(field==='url'?'https://changed.test':'User edit',item.id);
    assert.equal(queue.finish(job,{content:'Late capture'}),false);
    if(field!=='delete')library.remove(item.id);
  }
});
test('FTS failure rolls back the body, and an expired owner cannot publish results',t=>{
  const {library,db,queue}=fixture(t);
  const [item]=library.importItems([row('https://example.org')]).items;
  const job=queue.claim();
  db.exec('DROP TABLE stash_fts');
  assert.throws(()=>queue.finish(job,{content:'Captured'}),/stash_fts/);
  assert.equal(db.prepare('SELECT content FROM stash_items WHERE id=?').get(item.id).content,null);
  db.prepare("UPDATE app_meta SET value='other' WHERE key='web_content_worker_owner'").run();
  assert.equal(queue.finish(job,{content:'Captured'}),false);
});
test('an old image owner cannot starve text, but concurrent text providers share one lease',t=>{
  const {library,db,queue}=fixture(t);
  db.prepare("INSERT INTO app_meta VALUES('web_preview_worker_owner','older-provider')").run();
  db.prepare("INSERT INTO app_meta VALUES('web_preview_worker_until','9999999999')").run();
  library.importItems([row('https://example.org')]);
  assert.ok(queue.renew());assert.ok(queue.claim());
  const other=createContentQueue(library.dataDir,'other',{now:()=>100});
  try {assert.equal(other.renew(),false);assert.equal(other.claim(),null);}finally{other.close();}
});
test('quick save fills a provisional title and body, but preserves explicit edits',async t=>{
  const {library,db,queue}=fixture(t);
  const manual=(path,extra={})=>row('https://example.org/'+path,{title:'example.org',origin:{importMethod:'manual_url',pendingTitle:'example.org'},...extra});
  const [a]=library.importItems([manual('quick')]).items;
  const job=queue.claim();queue.finish(job,{title:'Fetched title',content:'Fetched body'});
  assert.equal((await library.readItems([a.id]))[0].title,'Fetched title');
  assert.equal(db.prepare('SELECT content FROM stash_items WHERE id=?').get(a.id).content,'Fetched body');
  const [b]=library.importItems([manual('edited')]).items;
  const stale=queue.claim();library.editMetadata(b.id,'example.org',[]);
  queue.finish(stale,{title:'Do not overwrite',content:'Read body'});
  assert.equal((await library.readItems([b.id]))[0].title,'example.org');
  library.importItems([manual('blank',{origin:{importMethod:'manual_url',contentEdited:true}})]);
  assert.equal(queue.claim(),null,'Explicitly cleared content must remain empty');
});
test('a title-only response does not declare missing content complete',t=>{
  const {library,db,queue}=fixture(t);
  library.importItems([row('https://example.org/empty',{title:'example.org',origin:{importMethod:'manual_url',pendingTitle:'example.org'}})]);
  const job=queue.claim();queue.finish(job,{title:'Fetched title',content:''});
  assert.equal(db.prepare('SELECT status FROM web_content_jobs').get().status,'failed');
  db.exec('UPDATE web_content_jobs SET retry_at=0');assert.ok(queue.claim());
});

test('foreground-settled imports remain final even when empty, without disabling screenshots',async t=>{
  const {library,db,queue}=fixture(t);
  const [item]=library.importItems([row('https://example.org/settled',{origin:{importMethod:'browser_bookmarks',contentSettled:true}})]).items;
  assert.equal(queue.claim(),null);
  const saved=(await library.readItems([item.id]))[0];assert.equal(saved.content,undefined);assert.equal(saved.contextOverride,undefined);
  assert.equal(db.prepare('SELECT count(*) n FROM web_content_jobs').get().n,0);
});

test('a read already in flight cannot change a newly settled import',t=>{
  const {library,db,queue}=fixture(t);
  library.importItems([row('https://example.org/late-settle')]);const job=queue.claim();
  db.prepare("UPDATE stash_items SET origin_json=json_set(origin_json,'$.contentSettled',json('true'))").run();
  assert.equal(queue.finish(job,{content:'Late result',title:'Late title'}),false);
  assert.equal(db.prepare('SELECT content FROM stash_items').get().content,null);
});
