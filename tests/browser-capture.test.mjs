import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { capturePage, captureCurrentDocument } from '../extension/page-capture.js';
import { captureActivePage } from '../extension/capture-client.js';
import { synchronizeActionBehavior } from '../extension/panel-behavior.js';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { openCaptureSite } from '../plugins/stashdock/server/open-capture-site.mjs';
import { buildContext } from '../src/lib/context-format.mjs';
import { DatabaseSync } from 'node:sqlite';
import { EventEmitter } from 'node:events';
import { createBrowserLibrary } from '../extension/library-client.js';
import { startCaptureBridge } from '../plugins/stashdock/server/capture-bridge.mjs';
import { once } from 'node:events';

test('browser bridge applies metadata and favorites only, retaining context and rejecting path/body edits', async t => {
  const root=mkdtempSync(join(tmpdir(),'stashdock-mcp-test-card-'));
  const library=createLocalLibrary({dataDir:root,browserEnabled:()=>true});
  const bridge=startCaptureBridge(library,0);await once(bridge,'listening');
  t.after(async()=>{await new Promise(resolve=>bridge.close(resolve));library.close();rmSync(root,{recursive:true,force:true});});
  const [item]=library.importItems([{title:'Original',kind:'web',source:'Web',url:'https://example.org',tags:[],content:'Actual body'}]).items;
  library.editContext(item.id,'Actual override');
  const url=`http://127.0.0.1:${bridge.address().port}/v1/items/${item.id}`;
  const origin='chrome-extension://'+'a'.repeat(32);
  const headers={'Content-Type':'application/json','X-StashDock-Client':'chrome-extension-v1',Origin:origin};
  const setup=await fetch(`http://127.0.0.1:${bridge.address().port}/v1/setup`,{method:'POST',headers,body:JSON.stringify({browser:'chrome',version:'0.4.13',extensionId:'a'.repeat(32)})});
  assert.equal(setup.status,200);
  for(const patch of [{favorite:true},{title:'Edited',tags:['Keep']}])assert.equal((await fetch(url,{method:'PATCH',headers,body:JSON.stringify(patch)})).status,200);
  for(const patch of [{content:'No'},{favorite:false,title:null},{title:null,tags:[]},{assetPath:'D:/private'}])assert.equal((await fetch(url,{method:'PATCH',headers,body:JSON.stringify(patch)})).status,400);
  const row=(await library.read())[0];assert.equal(row.content,'Actual body');assert.equal(row.contextOverride,'Actual override');assert.equal(row.title,'Edited');assert.equal(row.favorite,true);
  assert.equal((await fetch(url,{method:'PATCH',headers:{...headers,Origin:'https://evil.example'},body:'{"favorite":false}'})).status,403);
});

function page(html, url = 'https://example.org/article') {
  return new JSDOM(`<html><head><title>Readable article</title></head><body>${html}</body></html>`, { url }).window.document;
}

test('browser card edits survive offline restarts, target canonical IDs, and never edit context', async () => {
  let stored = {}, online = false;
  const storage = { get: async()=>structuredClone(stored), set: async data=>{stored=structuredClone(data);} };
  const row={id:'native-id',url:'https://example.org/one',title:'Original',tags:[],favorite:false};
  const calls=[];
  const fetcher=async (url,options) => {
    if (!online) throw Error('Offline');
    if (options.method==='PATCH') { calls.push({url,patch:JSON.parse(options.body)});Object.assign(row,JSON.parse(options.body));return Response.json({updated:true}); }
    return Response.json({duplicate:{id:row.id,title:row.title,revision:'revision'}});
  };
  let library=createBrowserLibrary({storage,fetcher});
  stored['stashdock-library-v1']={items:[row],imports:[],deletes:[],edits:[
    {id:'browser-id',url:row.url,patch:{favorite:true}},
    {id:'browser-id',url:row.url,patch:{title:'Edited',tags:['Keep']}}]};
  library=createBrowserLibrary({storage,fetcher});
  assert.equal(stored['stashdock-library-v1'].edits.length,2);
  assert.equal(library.patch,undefined); assert.equal(library.remove,undefined);
  online=true;const synced=await library.recoverPending();
  assert.equal(synced.pending,0);assert.equal(row.favorite,true);assert.equal(row.title,'Edited');assert.equal(stored['stashdock-library-v1'].items,undefined);
  assert.ok(calls.every(call=>call.url.endsWith('/items/native-id')));
});

test('the browser client repairs a missing provider registration once, then retries the original read', async () => {
  let registered = false, setups = 0;
  const storage = { get: async () => ({}), set: async () => {} };
  const library = createBrowserLibrary({
    storage,
    setup: async () => { setups += 1; registered = true; return { connected: true }; },
    fetcher: async url => url.endsWith('/tags')
      ? Response.json(registered ? { tags: ['Research'] } : { error: 'Run setup.' }, { status: registered ? 200 : 403 })
      : Response.json({ error: 'Unexpected route.' }, { status: 404 }),
  });
  assert.deepEqual(await library.tags(), ['Research']);
  assert.equal(setups, 1);
});

test('extension is a save-only native sidebar with shared fields and minimal permissions', () => {
  const manifest=JSON.parse(readFileSync('extension/manifest.json','utf8'));
  assert.equal(manifest.action.default_popup,undefined);
  assert.equal(manifest.side_panel.default_path,'sidepanel.html');
  assert.equal(manifest.web_accessible_resources,undefined);
  assert.deepEqual(manifest.permissions,['activeTab','scripting','storage','sidePanel']);
  assert.ok(!manifest.host_permissions.includes('<all_urls>'));
  assert.deepEqual(manifest.optional_host_permissions,['<all_urls>']);
  const popup=readFileSync('src/features/browser-extension/Popup.tsx','utf8');
  assert.match(popup,/ReferenceTagsField/);assert.match(popup,/void capture\(\)/);
  assert.doesNotMatch(popup,/ReferenceCardView|Copy for AI|renderShelf|GripVertical|startDrag/);
  assert.doesNotMatch(readFileSync('src/lib/captureSites.ts','utf8'),/weibo|wechat/i);
});
test('native sidebar opens in the gesture and saves through a token-bound worker', () => {
  const worker=readFileSync('extension/background.js','utf8');
  assert.match(worker,/chrome.action.onClicked/);assert.match(worker,/chrome.storage.session/);
  assert.ok(worker.indexOf('host.open(')<worker.indexOf('Promise.all([opening,authorization])'));
  assert.match(worker,/message.token!==entry.token/);assert.match(worker,/sender.tab\|\|sender.url/);
  assert.doesNotMatch(worker,/floating-panel|tabs.sendMessage|web_accessible_resources/);
  assert.match(readFileSync('extension/sidepanel.html','utf8'),/ui\/scrollbars.css/);
});

test('sidebar keeps durable Save in place, uses Chrome Close, and gives Content available height',()=>{
  const popup=readFileSync('src/features/browser-extension/Popup.tsx','utf8');
  const save=popup.slice(popup.indexOf('async function save'),popup.indexOf('return <MotionConfig'));
  assert.doesNotMatch(save,/services.close/);
  assert.match(save,/generation === current.current/);
  assert.match(popup,/aria-label="Refresh page"/);
  assert.doesNotMatch(popup,/aria-label="Close sidebar"/);
  const css=readFileSync('src/features/browser-extension/Popup.module.css','utf8');
  assert.match(css,/flex: 1 0 184px/);assert.doesNotMatch(css,/max-height: 160px/);
});
test('save-only sidebar migrates Chrome persisted auto-open behavior without consuming the capture gesture', async () => {
  let behavior={openPanelOnActionClick:true};
  await synchronizeActionBehavior({sidePanel:{setPanelBehavior:async next=>{behavior=next;}}});
  assert.deepEqual(behavior,{openPanelOnActionClick:false});
  for(const file of ['extension/background.js','extension/sidepanel.js'])assert.match(readFileSync(file,'utf8'),/synchronizeActionBehavior\(chrome\)/);
  assert.match(readFileSync('extension/background.js','utf8'),/const opening=host.open/);
});
const tweet = (id, text, more = '') => `<article data-testid="tweet"><div data-testid="User-Name">Dr Mira @mira</div><a href="/mira/status/${id}"><time datetime="2026-10-12T00:00:00Z">Today</time></a><div data-testid="tweetText">${text}</div>${more}</article>`;
test('current X post excludes feed neighbours, includes quotes, marks collapse and never falls back to the whole feed', () => {
  const url = 'https://x.com/mira/status/123456789';
  const doc = page(tweet('99999999','Unrelated feed secret') + tweet('123456789','Actual post<br>Second line','<div data-testid="tweetText">Quoted post</div><button data-testid="tweet-text-show-more-link">Show more</button>'), url);
  const item = capturePage(doc, url);
  assert.match(item.content, /Actual post\nSecond line/); assert.match(item.content,/Quoted post/);
  assert.doesNotMatch(item.content,/Unrelated|Show more|Today/); assert.equal(item.externalId,'123456789'); assert.equal(item.truncated,true);
  assert.equal(item.author,'Dr Mira @mira'); assert.equal(doc.querySelectorAll('article').length,2);
  for (const href of ['https://x.com/i/bookmarks','https://x.com/home','https://x.com/mira/status/55555555']) assert.throws(() => capturePage(doc,href),/individual|not loaded/);
});
test('generic reader preserves article text and excludes navigation, hidden text, fields and dialogs', () => {
  const doc = page('<nav>Browse account</nav><article><h1>A real article</h1><p>First paragraph with enough words to make this an article instead of a page menu.</p><p>Second paragraph.</p><span style="display:none">Hidden secret</span><form><input value="password"/><textarea>Private draft</textarea></form><div role="dialog">Sign in</div><script>token = secret</script></article>');
  const item = capturePage(doc,doc.URL);
  assert.match(item.content,/First paragraph/);assert.match(item.content,/Second paragraph/);
  assert.doesNotMatch(item.content,/Browse account|Hidden secret|Private draft|password|Sign in|token/);
  assert.equal(item.preview,''); assert.equal(doc.querySelector('textarea').textContent,'Private draft');
});
test('site adapters capture post content, not related cards or comments; unsupported states require selection', () => {
  const cases = [
    ['https://www.xiaohongshu.com/explore/123','<div class="note-detail-mask"><div class="note-content"><h1 id="detail-title">A note</h1><div id="detail-desc">Saved note text</div></div><div class="comments">Comment secret</div></div>','Xiaohongshu','Saved note text'],
    ['https://zhuanlan.zhihu.com/p/123','<h1 class="Post-Title">Article</h1><div class="Post-RichTextContainer">Saved article text</div><aside>Comment secret</aside>','Zhihu','Saved article text'],
  ];
  for (const [url,html,platform,body] of cases) {
    const item = capturePage(page(html,url),url); assert.equal(item.platform,platform);assert.match(item.content,new RegExp(body));assert.doesNotMatch(item.content,/Comment secret/);
    assert.throws(() => capturePage(page('<form>Sign in</form>',url),url),/individual|loaded/);
  }
});
test('explicit selection is a universal fallback, but form drafts are never captured', () => {
  const url = 'https://x.com/home', doc = page('<p id="selection">Only this selection</p><form><div contenteditable>Private draft</div></form>',url);
  const select = node => { const range = doc.createRange();range.selectNodeContents(node);const selection = doc.defaultView.getSelection();selection.removeAllRanges();selection.addRange(range); };
  select(doc.querySelector('#selection')); const item = capturePage(doc,url);assert.equal(item.content,'Only this selection');assert.equal(item.captureMethod,'selection');
  select(doc.querySelector('[contenteditable]'));assert.throws(() => capturePage(doc,url),/individual/);
});
test('automatic Save page ignores accidental leftover selection and reads the full post', () => {
  const doc=page('<main><p id="first">Short selected fragment</p><p>Full second paragraph that must also be saved.</p></main>');
  const range=doc.createRange();range.selectNodeContents(doc.querySelector('#first'));doc.defaultView.getSelection().addRange(range);
  const previousDoc=globalThis.document,previousLocation=globalThis.location;
  try{globalThis.document=doc;globalThis.location={href:doc.URL};const result=captureCurrentDocument();assert.match(result.page.content,/Full second paragraph/);assert.equal(result.page.captureMethod,'page');}
  finally{if(previousDoc===undefined)delete globalThis.document;else globalThis.document=previousDoc;if(previousLocation===undefined)delete globalThis.location;else globalThis.location=previousLocation;}
});
test('hidden adapter roots and unrelated Zhihu answers are never substituted for the current post', () => {
  const url='https://www.zhihu.com/question/42/answer/123';
  const doc=page('<h1 class="QuestionHeader-title">Question</h1><div class="AnswerItem" data-za-extra-module=\'{"card":{"content":{"token":"999"}}}\'><div class="RichContent-inner"><div class="RichText">Unrelated answer</div></div></div><div class="AnswerItem" data-za-extra-module=\'{"card":{"content":{"token":"123"}}}\'><div class="AuthorInfo-name">Mira</div><div class="RichContent-inner"><div class="RichText">The chosen answer</div></div></div>',url);
  const item=capturePage(doc,url);assert.equal(item.content,'The chosen answer');assert.equal(item.author,'Mira');
  const hidden=page(`<div style="display:none">${tweet('123','Hidden post')}</div>`,'https://x.com/mira/status/123');
  assert.throws(()=>capturePage(hidden,hidden.URL),/not loaded/);
  const feed=page('<div class="note-content">Unrelated recommendation</div>','https://www.xiaohongshu.com/explore');
  assert.throws(()=>capturePage(feed,feed.URL),/individual/);
});
test('long captures are bounded and accurately marked, and malicious URL credentials are rejected', () => {
  const url='https://www.xiaohongshu.com/explore/long';const item = capturePage(page(`<div class="note-content"><div id="detail-desc">${'文'.repeat(22000)}</div></div>`,url),url);
  assert.equal([...item.content].length,20000);assert.equal(item.truncated,true);
  for (const href of ['file:///secret','https://user:password@example.org']) assert.throws(() => capturePage(page('<main>Text</main>'),href),/HTTP/);
});
function browserFixture() {
  const listeners = () => { const set=new Set();return {set,addListener:fn=>set.add(fn),removeListener:fn=>set.delete(fn)}; };
  const current={id:7,windowId:2,url:'https://example.org/article',status:'complete'};
  const api={tabs:{onActivated:listeners(),onUpdated:listeners(),query:async()=>[current],captureVisibleTab:async()=> 'data:image/jpeg;base64,YQ=='},scripting:{executeScript:async()=>[{result:{page:{url:current.url,content:'Actual saved text',viewport:{width:1000,contentWidth:985}}}}]}};
  return {api,current,expected:{tabId:7,windowId:2,url:current.url}};
}
test('capture returns an explicit result from the extension isolated world, pinned to its original document', async () => {
  const {api,expected}=browserFixture(), calls=[];
  const saved=api.scripting.executeScript;
  api.scripting.executeScript=async options=>{calls.push(options);return options.files?[{frameId:0,documentId:'original-document'}]:saved();};
  await captureActivePage(api,expected,async data=>data);
  assert.equal(calls.length,2);assert.equal(calls[0].world,'ISOLATED');assert.equal(calls[1].world,'ISOLATED');
  assert.deepEqual(calls[1].target,{tabId:7,documentIds:['original-document']});
  assert.equal(typeof calls[1].func,'function');
  try {
    globalThis.StashDockPageCapture={captureCurrentDocument:()=>({page:{content:'Explicit body'}})};
    assert.equal(calls[1].func().page.content,'Explicit body');
    delete globalThis.StashDockPageCapture;
    assert.match(calls[1].func().error,/reader did not load/);
  } finally { delete globalThis.StashDockPageCapture; }
});
test('navigation between loading the reader and extracting its result aborts before screenshot', async () => {
  const {api,current,expected}=browserFixture();let screenshots=0;
  api.scripting.executeScript=async()=>{current.url='https://example.org/other';return [{frameId:0,documentId:'old'}];};
  api.tabs.captureVisibleTab=async()=>{screenshots++;};
  await assert.rejects(captureActivePage(api,expected,async data=>data),/changed/);
  assert.equal(screenshots,0);assert.equal(api.tabs.onUpdated.set.size,0);
});
test('SPA content can settle after load without another user click; readiness retry remains document-bound', async () => {
  const {api,expected}=browserFixture();let reads=0,waits=0;
  api.scripting.executeScript=async options=>options.files?[{frameId:0,documentId:'same-document'}]:++reads<3?[{frameId:0,result:{error:'Post is not loaded',retryable:true}}]:[{frameId:0,result:{page:{url:expected.url,content:'Settled post'}}}];
  const result=await captureActivePage(api,expected,async data=>data,async ms=>{assert.equal(ms,500);waits++;});
  assert.equal(result.content,'Settled post');assert.equal(waits,2);assert.equal(reads,3);
});
test('a nonempty but partial SPA body is sampled until stable before screenshot',async()=>{
  const {api,expected}=browserFixture();let reads=0;
  api.scripting.executeScript=async options=>options.files?[{frameId:0,documentId:'stable-document'}]:[{frameId:0,result:{page:{url:expected.url,content:++reads===1?'Partial body':'Full body with all paragraphs'}}}];
  const result=await captureActivePage(api,expected,async data=>data,async()=>{},()=>true,{settle:true});
  assert.equal(result.content,'Full body with all paragraphs');assert.equal(reads,4);
});
test('screenshot quota retries are bounded and revalidate the page after waiting', async () => {
  const {api,expected}=browserFixture();let shots=0,waits=0;
  api.tabs.captureVisibleTab=async()=>{if(++shots===1)throw Error('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND');return 'data:image/jpeg;base64,YQ==';};
  const item=await captureActivePage(api,expected,async data=>data,async ms=>{assert.equal(ms,1100);waits++;});
  assert.equal(item.previewKind,'screenshot');assert.equal(shots,2);assert.equal(waits,1);
  const next=browserFixture();let attempts=0;
  next.api.tabs.captureVisibleTab=async()=>{attempts++;throw Error('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND');};
  await assert.rejects(captureActivePage(next.api,next.expected,async data=>data,async()=>{next.current.url='https://example.org/other';}),/changed/);
  assert.equal(attempts,1);assert.equal(next.api.tabs.onUpdated.set.size,0);
});
test('text and screenshots are captured together, while tab/navigation races abort and detach listeners', async () => {
  const {api,expected}=browserFixture();const item=await captureActivePage(api,expected,async data=>data);assert.equal(item.content,'Actual saved text');assert.equal(item.previewKind,'screenshot');assert.equal(api.tabs.onActivated.set.size,0);
  for (const type of ['switch','navigate','switch-back']) {
    const {api,current,expected}=browserFixture();api.tabs.captureVisibleTab=async()=>{if(type==='navigate')current.url='https://example.org/other';else {for(const listener of api.tabs.onActivated.set)listener({windowId:2,tabId:8});if(type==='switch')current.id=8;}return 'wrong image';};
    await assert.rejects(captureActivePage(api,expected,async data=>data),/changed/);assert.equal(api.tabs.onUpdated.set.size,0);
  }
});
test('permission errors and failed extraction never import metadata-only references', async () => {
  const {api,expected}=browserFixture();api.scripting.executeScript=async()=>{throw Error('Permission missing');};
  await assert.rejects(captureActivePage(api,expected,async data=>data),/toolbar icon/);
  api.scripting.executeScript=async()=>[{result:{error:'Post is loading'}}];await assert.rejects(captureActivePage(api,expected,async data=>data),/loading/);
});
test('capture fills a bookmark body atomically, never overwrites existing bodies or final-context edits', async t => {
  const root=mkdtempSync(join(tmpdir(),'stashdock-mcp-test-capture-'));const library=createLocalLibrary({dataDir:root});
  t.after(()=>{library.close();assert.ok(root.startsWith(join(tmpdir(),'stashdock-mcp-test-')));rmSync(root,{recursive:true,force:true});});
  const raw={title:'User title',kind:'web',source:'Chrome',url:'https://example.org/article',tags:['Keep'],excerpt:'A bookmark'};
  const [row]=library.importItems([raw]).items;
  const capture={...raw,title:'Other title',tags:[],content:'captureduniquetoken\nSecond paragraph',origin:{importMethod:'browser_extension',platform:'example.org',captureMethod:'page',author:'Mira'}};
  assert.equal(library.importItems([capture]).updated,1);let saved=(await library.read())[0];assert.equal(saved.content,capture.content);assert.equal(saved.title,raw.title);assert.deepEqual(saved.tags,['Keep']);
  assert.match(buildContext([saved]),/captureduniquetoken/);library.importItems([{...capture,content:'Must not overwrite'}]);assert.equal((await library.read())[0].content,capture.content);
  const db=new DatabaseSync(join(root,'stashdock.sqlite3'));assert.equal(db.prepare("SELECT count(*) AS n FROM stash_fts WHERE stash_fts MATCH 'captureduniquetoken'").get().n,1);db.close();
  const [edited]=library.importItems([{...raw,url:'https://example.org/edited'}]).items;library.editContext(edited.id,'');library.importItems([{...capture,url:edited.url}]);saved=(await library.read()).find(item=>item.id===edited.id);assert.equal(saved.content,undefined);assert.equal(saved.contextOverride,'');
});
test('platform navigation only launches allowlisted sites in the default browser, without a new profile', async () => {
  const calls=[];const launch=(...args)=>{calls.push(args);const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child;};
  await openCaptureSite('x',{launch,platform:'win32'});assert.deepEqual(calls[0][1],['url.dll,FileProtocolHandler','https://x.com/']);assert.equal(calls[0][2].shell,false);assert.equal(calls[0][2].windowsHide,true);
  await assert.rejects(openCaptureSite('https://evil.test',{launch}),/supported/);assert.equal(calls.length,1);
});
test('two extension windows serialize legacy cache cleanup without dropping pending captures', async () => {
  let stored = {'stashdock-library-v1':{items:[{id:'old-cache'}],imports:[{id:'one',url:'https://example.org/one',content:'First post'},{id:'two',url:'https://example.org/two',content:'Second post'}]}}, queue = Promise.resolve();
  const locks = { request: (_, callback) => { const next=queue.then(callback,callback);queue=next.catch(()=>{});return next; } };
  const storage = { get: async()=>structuredClone(stored), set: async data=>{stored=structuredClone(data);} };
  const fetcher=async()=>{throw Error('Offline');};
  const first=createBrowserLibrary({storage,fetcher,locks}),second=createBrowserLibrary({storage,fetcher,locks});
  await Promise.all([first.tags(),second.tags(),first.recoverPending()]);
  assert.equal(stored['stashdock-library-v1'].items,undefined);
  const pending=stored['stashdock-library-v1'].imports;assert.equal(pending.length,2);assert.deepEqual(pending.map(item=>item.content),['First post','Second post']);
});
test('permissions and both host entry points exclude retired collection imports and session borrowing', () => {
  const manifest=JSON.parse(readFileSync('extension/manifest.json','utf8'));assert.deepEqual(manifest.host_permissions,['http://127.0.0.1:17863/*','http://127.0.0.1:17864/*']);assert.ok(!manifest.permissions.includes('cookies'));assert.ok(!manifest.permissions.includes('debugger'));
  for(const path of ['src/components/DesktopImportDialog.tsx','src/lib/linkImport.ts','src/features/mcp-app/import.ts','src-tauri/src/lib.rs','src-tauri/src/main.rs','src-tauri/src/web_preview.rs','src-tauri/src/bin/preview-helper.rs','plugins/stashdock/server/preview-worker.mjs','plugins/stashdock/server/create-server.mjs'])assert.doesNotMatch(readFileSync(path,'utf8'),/XImportPanel|platform_import|capture_if_connected|connector::|connect_stashdock_platform|preview_with_session/);
});
