// Read-only diagnostic. Only bookmark URLs are queried; no URLs or image bytes are logged.
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';

const [bookmarksPath, faviconsPath] = process.argv.slice(2);
if (!bookmarksPath || !faviconsPath) throw new Error('Provide the exact Bookmarks and Favicons files.');
const bookmarks = JSON.parse(await readFile(bookmarksPath, 'utf8'));
const urls = new Set();
function walk(node) {
  if (node?.type === 'url') {
    try { const url = new URL(node.url); if (/^https?:$/.test(url.protocol)) urls.add(node.url); } catch {}
  }
  for (const child of node?.children || []) walk(child);
}
for (const root of Object.values(bookmarks.roots || {})) walk(root);
const database = new DatabaseSync(faviconsPath, { readOnly: true });
try {
  database.exec('PRAGMA busy_timeout = 1000');
  const query = database.prepare('SELECT b.image_data FROM icon_mapping m JOIN favicon_bitmaps b ON b.icon_id = m.icon_id WHERE m.page_url = ? AND length(b.image_data) > 8 ORDER BY b.width DESC LIMIT 1');
  let withCachedPng = 0;
  for (const url of urls) {
    const row = query.get(url);
    if (row && Buffer.from(row.image_data).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) withCachedPng++;
  }
  console.log(JSON.stringify({ webBookmarks: urls.size, exactUrlWithCachedPng: withCachedPng, unavailableInExactCache: urls.size - withCachedPng }));
} catch (error) {
  console.log(JSON.stringify({ webBookmarks: urls.size, cacheReadable: false, reason: error.errcode === 5 ? 'Browser cache is locked by its owner' : 'Browser cache format is unavailable' }));
  process.exitCode = 1;
} finally { database.close(); }
