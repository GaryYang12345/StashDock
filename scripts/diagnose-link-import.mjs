// Read-only link-import diagnosis on this computer. Uses the native preview
// helper exactly as imports do, reads one browser's bookmarks, and measures the
// text lane and the screenshot lane separately. Never opens or writes a library.
//
//   node scripts/diagnose-link-import.mjs [--helper path] [--source id | --urls file.txt] [--limit 40] [--screenshots 12]
//
// Output: output/diagnose-link-import/report.json and screenshots beside it.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createPreviewSession, createPreviewSessionPool } from '../plugins/stashdock/server/preview-session.mjs';

const option = (name, fallback) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : fallback; };
const helper = resolve(option('helper', ['plugins/stashdock/bin/win32-x64/stashdock-preview.exe', 'src-tauri/target/release/stashdock-preview.exe'].find(existsSync) || ''));
if (!existsSync(helper)) throw Error('Build the helper first: npm run preview:helper');
const limit = Number(option('limit', 40)), screenshotLimit = Number(option('screenshots', 12));
const outputDirectory = resolve('output/diagnose-link-import');
await mkdir(outputDirectory, { recursive: true });

function systemProxy() {
  if (process.platform !== 'win32') return null;
  const read = name => { try { return execFileSync('reg.exe', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings', '/v', name], { encoding: 'utf8', windowsHide: true, timeout: 2000 }).match(/REG_\w+\s+(.+)$/m)?.[1]?.trim(); } catch { return undefined; } };
  return { enabled: read('ProxyEnable'), server: read('ProxyServer'), autoConfigUrl: read('AutoConfigURL') };
}
async function dnsSample() {
  const result = {};
  for (const host of ['www.google.com', 'github.com', 'www.zhihu.com', 'developer.mozilla.org', 'x.com']) {
    const started = performance.now();
    try { result[host] = { addresses: (await lookup(host, { all: true })).map(entry => entry.address), ms: Math.round(performance.now() - started) }; }
    catch (error) { result[host] = { error: error.code || error.message, ms: Math.round(performance.now() - started) }; }
  }
  return result;
}
const percentile = (values, p) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : null; };
const summarize = rows => {
  const ms = rows.map(row => row.ms), errors = {};
  for (const row of rows) if (row.error) errors[row.error] = (errors[row.error] || 0) + 1;
  return { count: rows.length, ok: rows.filter(row => !row.error).length, p50: percentile(ms, 0.5), p90: percentile(ms, 0.9), max: Math.max(0, ...ms), errors };
};

// The helper reports failures as {error}; surface them as rejections.
const call = async (session, request, timeout) => { const value = await session.run(request, undefined, { timeout }); if (value?.error) throw Error(value.error); return value; };

const report = { startedAt: new Date().toISOString(), platform: `${process.platform}-${process.arch}`, helper, proxy: systemProxy(), dns: await dnsSample() };
const control = createPreviewSession(helper);
try {
  let chosen = option('source'), bookmarks = [];
  if (option('urls')) {
    chosen = resolve(option('urls'));
    bookmarks = (await readFile(chosen, 'utf8')).split(/\r?\n/).map(url => ({ url: url.trim() })).filter(value => value.url);
  } else {
    const sources = await call(control, { browserOperation: 'sources' }, 30_000);
    report.sources = sources.map(({ id, browser, profile }) => ({ id, browser, profile }));
    for (const source of chosen ? sources.filter(value => value.id === chosen) : sources) {
      const values = await call(control, { browserOperation: 'bookmarks', sourceId: source.id }, 30_000);
      if (values.length > bookmarks.length) { bookmarks = values; chosen = source.id; }
    }
  }
  report.source = chosen;
  const seen = new Set();
  const urls = bookmarks.map(value => value.url).filter(url => /^https?:/i.test(url) && !seen.has(url) && seen.add(url)).slice(0, limit);
  report.bookmarksRead = bookmarks.length;
  console.log(`Testing ${urls.length} bookmarks from ${chosen}…`);

  // Text lane: four concurrent readers, as Desktop and MCP imports use.
  const readers = createPreviewSessionPool(helper, 4);
  const text = [];
  let next = 0;
  const textStarted = performance.now();
  try {
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (next < urls.length) {
        const url = urls[next++], started = performance.now();
        try {
          const value = await call(readers, { url, contentOnly: true }, 60_000);
          text.push({ url, ms: Math.round(performance.now() - started), characters: value.content?.length || 0, title: Boolean(value.title) });
        } catch (error) { text.push({ url, ms: Math.round(performance.now() - started), error: error.message }); }
        process.stdout.write(`\rText ${text.length}/${urls.length}`);
      }
    }));
  } finally { await readers.close(); }
  report.text = { wallMs: Math.round(performance.now() - textStarted), summary: summarize(text), emptyBodies: text.filter(row => !row.error && !row.characters).length, rows: text };
  console.log(`\nText lane: ${report.text.wallMs} ms wall`, report.text.summary);

  // Screenshot lane: one renderer, serial, as background enrichment uses per lane.
  const shots = [];
  const shotsStarted = performance.now();
  for (const [index, url] of urls.slice(0, screenshotLimit).entries()) {
    const started = performance.now();
    try {
      const value = await call(control, { url, needPreview: true, faviconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' }, 90_000);
      const row = { url, ms: Math.round(performance.now() - started), kind: value.previewKind || null };
      if (value.preview?.startsWith('data:image/')) {
        const file = join(outputDirectory, `${String(index).padStart(2, '0')}-${new URL(url).hostname.replace(/[^\w.-]/g, '-')}.jpg`);
        await writeFile(file, Buffer.from(value.preview.split(',')[1], 'base64'));
        row.image = file;
      } else row.error = 'No screenshot (default cover)';
      shots.push(row);
    } catch (error) { shots.push({ url, ms: Math.round(performance.now() - started), error: error.message }); }
    process.stdout.write(`\rScreenshots ${shots.length}/${Math.min(screenshotLimit, urls.length)}`);
  }
  report.screenshots = { wallMs: Math.round(performance.now() - shotsStarted), summary: summarize(shots), rows: shots };
  console.log(`\nScreenshots: ${report.screenshots.wallMs} ms wall`, report.screenshots.summary);
} finally {
  await control.close();
  await writeFile(join(outputDirectory, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Report: ${join(outputDirectory, 'report.json')}`);
}
