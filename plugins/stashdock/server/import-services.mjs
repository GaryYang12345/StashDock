// Import adapters for the independent MCP process. Never asks the iframe for
// filesystem access, accepts arbitrary paths, or touches browser cookies.
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { loadBuffer } from 'cheerio';

export function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 ||
      a === 192 && (b === 168 || b === 0 || b === 2) ||
      a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) ||
      a === 203 && b === 0 && c === 113);
  }
  if (isIP(address) !== 6 || address.includes('.')) return false;
  const pieces = address.toLowerCase().split(':');
  const a = parseInt(pieces[0] || '0', 16), b = parseInt(pieces[1] || '0', 16);
  return a >= 0x2000 && a < 0x4000 && a !== 0x2002 &&
    !(a === 0x2001 && (b < 0x200 || b === 0xdb8)) && !(a === 0x3fff && b < 0x1000);
}
export function publicWebUrl(raw) {
  const url = new URL(raw);
  if (raw.length > 8192 || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port && !['80', '443'].includes(url.port)) throw new Error('Use a public http or https link without credentials.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !publicAddress(host)) throw new Error('Only public websites can be read automatically.');
  return url;
}
const withDeadline = (promise, milliseconds) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The page took too long to respond. Retry or enter its details manually.')), milliseconds); })]).finally(() => clearTimeout(timer));
};
export function requestPage(url, address, timeout) {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      agent: false, timeout,
      // Pin the validated DNS answer for this connection, including TLS SNI.
      lookup: (_host, options, callback) => options?.all ? callback(null, [address]) : callback(null, address.address, address.family),
      headers: { 'User-Agent': 'StashDock/1.0', Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
    }, response => {
      const chunks = []; let bytes = 0;
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers.location; response.destroy(); resolve({ location, status: response.statusCode }); return;
      }
      if (response.statusCode < 200 || response.statusCode >= 300 || response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
        response.destroy(); reject(new Error('This page could not be read. Enter its details manually.')); return;
      }
      if (!/^(text\/html|application\/xhtml\+xml)/i.test(response.headers['content-type'] || '')) {
        response.destroy(); reject(new Error('This link does not contain a web page. Use File to import a document.')); return;
      }
      response.on('data', chunk => { bytes += chunk.length; if (bytes > 3_000_000) { request.destroy(new Error('This page is too large to read automatically.')); return; } chunks.push(chunk); });
      response.on('end', () => resolve({ body: Buffer.concat(chunks), status: response.statusCode }));
      response.on('error', reject); response.on('aborted', () => reject(new Error('The page response was interrupted. Retry the lookup.')));
    });
    const timer = setTimeout(() => request.destroy(new Error('The page took too long to respond.')), timeout);
    request.on('close', () => clearTimeout(timer)); request.on('timeout', () => request.destroy(new Error('The page took too long to respond.'))); request.on('error', reject);
  });
}
export function parsePage(body, url) {
  const $ = loadBuffer(body);
  const title = ($('meta[property="og:title"]').attr('content') || $('title').first().text() || new URL(url).hostname).trim().slice(0, 500);
  let faviconUrl = new URL('/favicon.ico', url).href;
  const icon = $('link[rel]').toArray().find(element => /(?:^|\s)(?:icon|apple-touch-icon)(?:\s|$)/i.test($(element).attr('rel') || ''));
  try { if (icon) faviconUrl = publicWebUrl(new URL($(icon).attr('href'), url).href).href; } catch { /* Keep the public origin fallback. */ }
  $('script,style,noscript,nav,footer,header,svg,form,[hidden]').remove();
  $('br').replaceWith('\n'); $('p,h1,h2,h3,h4,li,section,div').append('\n');
  const root = $('main').first().length ? $('main').first() : $('article').first().length ? $('article').first() : $('body');
  const content = root.text().replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 50_000);
  return { title, content, faviconUrl };
}
export function createLinkPreview({ resolve = host => lookup(host, { all: true, verbatim: true }), request = requestPage, fallback } = {}) {
  let active = 0;
  return async raw => {
    if (active >= 4) throw new Error('Another page is being read. Retry in a moment.');
    active++;
    const deadline = Date.now() + 15_000;
    try {
      let url = publicWebUrl(raw);
      for (let redirects = 0; redirects <= 5; redirects++) {
        const host = url.hostname.replace(/^\[|\]$/g, '');
        const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await withDeadline(resolve(host), Math.min(3000, Math.max(1, deadline - Date.now())));
        if (!addresses.length || addresses.some(value => !publicAddress(value.address))) throw new Error('Only public websites can be read automatically.');
        const remaining = deadline - Date.now(); if (remaining <= 0) throw new Error('The page took too long to respond.');
        let result, lastError;
        for (const address of addresses.slice(0,4)) {
          const budget = Math.min(6500, deadline-Date.now()); if(budget<=0) break;
          try { result = await withDeadline(request(url, address, budget), budget); break; }
          catch (error) { lastError = error; }
        }
        if(!result) {
          // DNS validation above always runs first. The independent helper repeats
          // public-only checks for every connection and redirect; never bypass them.
          if (fallback) return await fallback(url.href);
          throw lastError || Error('The page took too long to respond. Retry the lookup.');
        }
        if (result.location) { url = publicWebUrl(new URL(result.location, url).href); continue; }
        if (!result.body) throw new Error('This page could not be read. Enter its details manually.');
        return parsePage(result.body, url.href);
      }
      throw new Error('This page redirected too many times. Enter its details manually.');
    } finally { active--; }
  };
}

async function within(root, path) {
  const base = await realpath(root), target = await realpath(path), offset = relative(base, target);
  if (offset === '..' || offset.startsWith('..\\') || offset.startsWith('../') || isAbsolute(offset)) throw new Error('The browser profile is outside its expected folder.');
  return target;
}
const webBookmark = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } };
const bounded = async path => { if ((await stat(path)).size > 32 * 1024 * 1024) throw new Error('This bookmark file is too large to import.'); return JSON.parse(await readFile(path, 'utf8')); };
export function chromiumBookmarks(data) {
  const rows = [];
  const visit = (node, folders, depth) => {
    if (depth > 64 || rows.length > 50_000) throw new Error('This bookmark collection is too large to import.');
    if (!node || typeof node !== 'object') return;
    if (node.type === 'url' && typeof node.url === 'string' && node.url.length <= 8192 && webBookmark(node.url)) {
      let savedAt;
      try { if (typeof node.date_added === 'string' && /^\d{1,20}$/.test(node.date_added)) savedAt = new Date(Number(BigInt(node.date_added) / 1000n - 11644473600000n)).toISOString(); } catch { /* Invalid optional date. */ }
      rows.push({ title: (typeof node.name === 'string' ? node.name : new URL(node.url).hostname).slice(0, 500), url: node.url, folderPath: folders, savedAt });
    }
    if (Array.isArray(node.children)) for (const child of node.children) visit(child, node.name ? [...folders, String(node.name).slice(0, 200)] : folders, depth + 1);
  };
  for (const node of Object.values(data.roots || {})) visit(node, [], 0);
  if (rows.length > 50_000) throw new Error('This bookmark collection is too large to import.');
  return rows;
}
function cachedIcons(path, rows) {
  let db, total = 0;
  try {
    db = new DatabaseSync(path, { readOnly: true }); db.exec('PRAGMA busy_timeout=200; BEGIN');
    const query = db.prepare('SELECT b.image_data FROM icon_mapping m JOIN favicon_bitmaps b ON b.icon_id=m.icon_id WHERE m.page_url=? AND length(b.image_data) BETWEEN 8 AND 131072 ORDER BY ABS(b.width-32) LIMIT 1');
    for (const row of rows.slice(0, 2000)) {
      const bytes = query.get(row.url)?.image_data;
      if (!bytes) continue;
      if ((total += bytes.length) > 4_000_000) break;
      const image = Buffer.from(bytes), mime = image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' : image[0] === 255 && image[1] === 216 ? 'jpeg' : null;
      if (mime) row.faviconUrl = `data:image/${mime};base64,${image.toString('base64')}`;
    }
  } catch { /* Icons are optional. The shared favicon component has fallbacks. */ }
  finally { db?.close(); }
  return rows;
}
function firefoxBookmarks(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    db.exec('PRAGMA busy_timeout=200; BEGIN');
    const folderRows = db.prepare("SELECT id,parent,COALESCE(title,'') title,guid FROM moz_bookmarks WHERE type=2 LIMIT 50001").all();
    if (folderRows.length > 50_000) throw new Error('This bookmark collection is too large to import.');
    const folders = new Map(folderRows.map(row => [row.id, row]));
    const values = db.prepare("SELECT COALESCE(b.title,p.title,'') title,p.url,b.parent,b.dateAdded FROM moz_bookmarks b JOIN moz_places p ON p.id=b.fk WHERE b.type=1 ORDER BY b.id LIMIT 50001").all();
    if (values.length > 50_000) throw new Error('This bookmark collection is too large to import.');
    return values.flatMap(row => {
      if (!webBookmark(row.url) || row.url.length > 8192) return [];
      const path = [], seen = new Set(); let parent = row.parent;
      while (folders.has(parent)) {
        if (seen.has(parent) || seen.size >= 64) throw new Error('This bookmark folder could not be read.');
        seen.add(parent); const folder = folders.get(parent);
        if (folder.guid === 'tags________') return [];
        if (folder.title) path.unshift(folder.title.slice(0, 200)); parent = folder.parent;
      }
      let savedAt; try { if (row.dateAdded) savedAt = new Date(Number(row.dateAdded) / 1000).toISOString(); } catch { /* Optional date. */ }
      return [{ title: row.title.slice(0, 500), url: row.url, folderPath: path, savedAt }];
    });
  } finally { db.close(); }
}
export function createImportServices({ env = process.env, platform = process.platform, preview = createLinkPreview() } = {}) {
  const roots = platform === 'win32' ? [
    env.LOCALAPPDATA && ['chrome', 'Chrome', join(env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data'), 'Bookmarks'],
    env.LOCALAPPDATA && ['edge', 'Edge', join(env.LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data'), 'Bookmarks'],
    env.APPDATA && ['firefox', 'Firefox', join(env.APPDATA, 'Mozilla', 'Firefox', 'Profiles'), 'places.sqlite'],
  ].filter(Boolean) : [];
  async function discover() {
    const profiles = [];
    for (const [key, browser, root, file] of roots) {
      let entries; try { entries = await readdir(root, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) {
        if (!entry.isDirectory() || key !== 'firefox' && entry.name !== 'Default' && !/^Profile \d+$/.test(entry.name)) continue;
        try { const path = await within(root, join(root, entry.name, file)); profiles.push({ id: `${key}:${entry.name}`, browser, profile: entry.name, root, path }); } catch { /* Unavailable profiles are not offered. */ }
      }
    }
    return profiles;
  }
  return {
    sources: async () => (await discover()).map(({ id, browser, profile }) => ({ id, browser, profile })),
    bookmarks: async sourceId => {
      const source = (await discover()).find(item => item.id === sourceId);
      if (!source) throw new Error('This browser profile is no longer available. Reopen Import from.');
      if (source.browser === 'Firefox') return firefoxBookmarks(source.path);
      const rows = chromiumBookmarks(await bounded(source.path));
      try { const profileRoot = join(source.root, source.profile); return cachedIcons(await within(profileRoot, join(profileRoot, 'Favicons')), rows); } catch { return rows; }
    },
    preview,
  };
}
