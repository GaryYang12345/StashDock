import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const probe = readFileSync('src-tauri/src/preview_ready.js', 'utf8');
function fixture(html = '<main>Ready content</main>') {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.org/' });
  const { document } = dom.window;
  Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
  Object.defineProperty(document.body, 'innerText', { configurable: true, get: () => document.body.textContent });
  Object.defineProperty(document, 'fonts', { configurable: true, value: { status: 'loaded' } });
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 600, bottom: 300, width: 600, height: 300 };
  for (const node of document.querySelectorAll('*')) node.getBoundingClientRect = () => rect;
  document.elementFromPoint = () => document.querySelector('main') || document.body;
  return { document, read: () => dom.window.eval(probe), close: () => dom.window.close() };
}
test('viewport readiness rejects blank/loading documents and waits for visible images, fonts and busy content', () => {
  const page = fixture('<main>Article<img src="hero.jpg"><div aria-busy="true">Loading</div></main>');
  try {
    const image=page.document.querySelector('img');
    Object.defineProperty(image,'complete',{configurable:true,value:false});
    assert.equal(page.read().ready,false);
    assert.equal(page.read().drawable,true,'Slow subresources do not make the existing page blank');
    Object.defineProperty(image,'complete',{configurable:true,value:true});
    assert.equal(page.read().ready,false);
    page.document.querySelector('[aria-busy]').removeAttribute('aria-busy');
    assert.equal(page.read().ready,true);
    page.document.fonts.status='loading'; assert.equal(page.read().ready,false);
    page.document.fonts.status='loaded';
    Object.defineProperty(page.document,'readyState',{value:'loading'}); assert.equal(page.read().ready,false);
  } finally { page.close(); }
  const blank=fixture(''); try { assert.equal(blank.read().ready,false); assert.equal(blank.read().drawable,false); } finally { blank.close(); }
});
test('readiness signatures track late body/layout/image changes but ignore offscreen loading images', () => {
  const page=fixture('<main>First body</main><img src="below.jpg">');
  try {
    const image=page.document.querySelector('img');
    image.getBoundingClientRect=()=>({x:0,y:2000,top:2000,left:0,right:100,bottom:2100,width:100,height:100});
    Object.defineProperty(image,'complete',{value:false});
    const first=page.read(); assert.equal(first.ready,true);
    page.document.querySelector('main').textContent='Full body after hydration';
    const next=page.read(); assert.notEqual(next.signature,first.signature);
    page.document.querySelector('main').getBoundingClientRect=()=>({x:0,y:0,width:900,height:600});
    assert.notEqual(page.read().signature,next.signature);
    assert.equal(page.document.querySelector('img').getAttribute('src'),'below.jpg','Probe must not mutate the page');
  } finally { page.close(); }
});

test('parser-blocking scripts do not hide a painted page from the bounded capture fallback', () => {
  const page = fixture('<main><h1>Benefits of Community Service</h1><p>Painted article text remains useful while a third-party script stalls.</p></main>');
  try {
    Object.defineProperty(page.document, 'readyState', { value: 'loading' });
    const scene = page.read();
    assert.equal(scene.ready, false, 'Do not claim that all resources are ready');
    assert.equal(scene.drawable, true, 'The existing article is not a blank page');
    assert.equal(typeof scene.signature, 'number');
  } finally { page.close(); }
  const blank = fixture('');
  try {
    Object.defineProperty(blank.document, 'readyState', { value: 'loading' });
    assert.equal(blank.read().drawable, false, 'Loading alone never permits a blank capture');
  } finally { blank.close(); }
});
