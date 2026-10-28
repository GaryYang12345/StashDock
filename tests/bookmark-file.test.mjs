import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('');
globalThis.DOMParser = dom.window.DOMParser;
const compiled = await build({ entryPoints: ['src/lib/bookmarkFile.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { parseBookmarkHtml, readBookmarkFile, bookmarkBrowsers } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));

test('four browser choices do not depend on filesystem discovery', () => {
  assert.deepEqual([...bookmarkBrowsers], ['Chrome', 'Edge', 'Firefox', 'Safari']);
});
test('Chrome, Edge, Firefox and Safari Netscape exports preserve nested folders and dates', () => {
  const rows = parseBookmarkHtml(`<!DOCTYPE NETSCAPE-Bookmark-file-1><META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8"><DL><p>
  <DT><H3>收藏夹</H3><DL><p><DT><H3>Research</H3><DL><p>
  <DT><A HREF="https://example.org/a?x=1&amp;y=2" ADD_DATE="1700000000">A &amp; B</A></DL><p>
  <DT><A HREF="https://example.org/b">Sibling</A></DL><p>
  <DT><A HREF="https://example.org/root">Root</A></DL>`);
  assert.deepEqual(rows.map(row => row.folderPath), [['收藏夹', 'Research'], ['收藏夹'], []]);
  assert.equal(rows[0].title, 'A & B');
  assert.equal(rows[0].url, 'https://example.org/a?x=1&y=2');
  assert.equal(rows[0].savedAt, '2023-11-14T22:13:20.000Z');
});
test('non-web and credential URLs are excluded; exported scripts never run', () => {
  const rows = parseBookmarkHtml('<DL><DT><A HREF="javascript:alert(1)">script</A><DT><A HREF="file:///secret">file</A><DT><A HREF="https://u:p@example.org">credentials</A><DT><A HREF="https://example.org">Web</A></DL><script>throw Error()</script>');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Web');
});
test('wrong exports, oversized files, and deep or huge collections have actionable errors', async () => {
  assert.throws(() => parseBookmarkHtml('<html>Not bookmarks</html>'), /exported/);
  await assert.rejects(readBookmarkFile({ name: 'Safari.zip', size: 20, text: async () => '' }), /HTML/);
  await assert.rejects(readBookmarkFile({ name: 'bookmarks.html', size: 33 * 1024 * 1024, text: async () => { throw Error('must not read'); } }), /32 MB/);
  assert.throws(() => parseBookmarkHtml('<DL><DT><H3>Folder</H3>'.repeat(70) + '</DL>'.repeat(70)), /nested/);
  assert.throws(() => parseBookmarkHtml('<DL>' + '<DT><A HREF="https://example.org">A</A>'.repeat(50_001) + '</DL>'), /too large/);
});
