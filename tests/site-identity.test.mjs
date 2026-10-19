import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = ts.transpileModule(await readFile(new URL('../src/lib/siteIdentity.ts', import.meta.url), 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {normalizeFavicon, faviconCandidates, siteLabel} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('saved browser favicon precedes the original site fallback without a proxy', () => {
  const item = {url:'https://www.example.com/page?q=1',source:'Example',origin:{faviconUrl:'https://cdn.example.com/icon.png'}};
  assert.deepEqual(faviconCandidates(item),['https://cdn.example.com/icon.png','https://www.example.com/favicon.ico','https://www.example.com/favicon.svg','https://www.example.com/favicon.png','https://www.example.com/apple-touch-icon.png']);
  assert.equal(siteLabel(item),'example.com');
  const deduplicated = faviconCandidates({url:'https://example.com',origin:{faviconUrl:'/favicon.ico'}});
  assert.equal(deduplicated[0],'https://example.com/favicon.ico');
  assert.equal(deduplicated.length,4);
});

test('old bookmarks try only bounded image paths on their own origin', () => {
  const candidates = faviconCandidates({url:'https://docs.example.com:8443/guide?q=private#section'});
  assert.equal(candidates.length,4);
  for (const candidate of candidates) {
    const url = new URL(candidate);
    assert.equal(url.origin,'https://docs.example.com:8443');
    assert.equal(url.search,'');
    assert.equal(url.hash,'');
  }
  assert.deepEqual(faviconCandidates({url:'https://user:pass@example.com/page'}),[]);
  assert.deepEqual(faviconCandidates({url:'chrome://bookmarks/'}),[]);
});

test('favicon sources reject privileged protocols, credentials and oversized data', () => {
  for (const raw of ['file:///private','javascript:alert(1)','chrome://favicon/https://example.com','https://user:pass@example.com/icon','data:image/svg+xml,<svg/>','data:image/png;base64,'+'A'.repeat(33000)]) assert.equal(normalizeFavicon(raw),undefined);
  assert.equal(normalizeFavicon('/icon.png','https://example.com/path'),'https://example.com/icon.png');
  assert.equal(normalizeFavicon('data:image/png;base64,AAAA'),'data:image/png;base64,AAAA');
  assert.deepEqual(faviconCandidates({url:'file:///private'}),[]);
  assert.deepEqual(faviconCandidates({}),[]);
  assert.equal(siteLabel({source:'Note'}),'Note');
});

test('browser extension persists the same validated favicon metadata', async () => {
  const extension = await import('../extension/ui/siteIdentity.js');
  assert.equal(extension.normalizeFavicon('/icon.png','https://example.com'),normalizeFavicon('/icon.png','https://example.com'));
  const capture = await readFile(new URL('../extension/sidepanel.js',import.meta.url),'utf8');
  assert.match(capture,/faviconUrl:normalizeFavicon\(page.faviconUrl \|\| entry.faviconUrl, url.href\)/);
});
