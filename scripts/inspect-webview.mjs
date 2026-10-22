// Reads the development Desktop WebView through its loopback DevTools port
// (started by scripts/claude-runner.ps1 dev-start): page state, console
// messages, exceptions and a screenshot of every page. Read-only unless
// --reload is given, which reloads each page to capture startup errors.
//
//   node scripts/inspect-webview.mjs [--port 9229] [--reload] [--seconds 4] [--out dir]
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const option = (name, fallback) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : fallback; };
const port = Number(option('port', 9229)), seconds = Number(option('seconds', 4)), reload = process.argv.includes('--reload');
// Fixed, read-mostly layout probes. Each may open UI (never saves or deletes).
const probes = {
  // Read-only: what one library refresh costs and how often the page has asked for one.
  'library-load': `(async () => {
    const calls = performance.getEntriesByType('resource').filter(entry => entry.name.startsWith('http://ipc.localhost/'));
    const byCommand = {};
    for (const entry of calls) { const name = entry.name.slice(21); const row = byCommand[name] ??= { count: 0, totalMs: 0, maxMs: 0 }; row.count++; row.totalMs += Math.round(entry.duration); row.maxMs = Math.max(row.maxMs, Math.round(entry.duration)); }
    const runs = [];
    for (let i = 0; i < 3; i++) { const started = performance.now(); const items = await window.__TAURI_INTERNALS__.invoke('list_items'); const json = JSON.stringify(items);
      runs.push({ ms: Math.round(performance.now() - started), items: items.length, bytes: json.length, contentBytes: items.reduce((sum, item) => sum + (item.content?.length || 0) + (item.contextOverride?.length || 0), 0), previewBytes: items.reduce((sum, item) => sum + (item.preview?.length || 0), 0) }); }
    return { sinceLoadSeconds: Math.round(performance.now() / 1000), ipc: byCommand, listItems: runs };
  })()`,
  // Types into the shelf search (UI state only) and times each keystroke until the next painted frame.
  'search-typing': `(async () => {
    const input = document.querySelector('input[type="search"]');
    if (!input) return 'no search field';
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const frame = () => new Promise(done => requestAnimationFrame(() => setTimeout(done, 0)));
    const longTasks = []; const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => Math.round(entry.duration)))); observer.observe({ type: 'longtask' });
    const steps = [];
    for (const value of ['p', 'pr', 'p', '', 'p', '']) {
      const started = performance.now();
      setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true }));
      await frame();
      const typed = Math.round(performance.now() - started);
      await new Promise(done => setTimeout(done, 700));
      steps.push({ value, frameMs: typed, cards: document.querySelectorAll('article[data-reference-id]').length });
    }
    observer.disconnect();
    return { steps, longTasks };
  })()`,
  // Development only: drives two collapse/expand round trips through the
  // lifecycle authority (panel page only), for the native handoff capture.
  'handoff': `(async () => {
    if (location.search.includes('surface=')) return 'skipped: not the panel';
    const invoke = window.__TAURI_INTERNALS__.invoke, wait = ms => new Promise(done => setTimeout(done, ms));
    const modes = [];
    for (let round = 0; round < 2; round++) {
      for (const target of ['folder', 'panel']) { const status = await invoke('set_desktop_surface', { target }); modes.push(status?.mode ?? status); await wait(1600); }
    }
    return modes;
  })()`,
  'import-dialog': `(async () => {
    let dialog = document.querySelector('[data-size="import"]');
    if (!dialog) { [...document.querySelectorAll('button')].find(button => /Import references|导入引用/.test(button.textContent))?.click(); await new Promise(done => setTimeout(done, 1500)); dialog = document.querySelector('[data-size="import"]'); }
    if (!dialog) return 'no import dialog';
    const box = element => Math.round(element.getBoundingClientRect().height);
    const tall = [...dialog.querySelectorAll('*')].filter(element => box(element) > 200).map(element => ({ tag: element.tagName, cls: String(element.className).slice(0, 60), h: box(element), style: element.getAttribute('style')?.slice(0, 120) }));
    return { dialog: box(dialog), styleHeight: dialog.style.height, viewport: [innerWidth, innerHeight], tall: tall.slice(0, 25) };
  })()`,
};
import { existsSync, readFileSync } from 'node:fs';

const outputDirectory = resolve(option('out', 'output/claude-review'));
await mkdir(outputDirectory, { recursive: true });
const probeFile = join(outputDirectory, 'probe.txt');
// probe.txt: "<probe> [profile]". With profile, the probe runs under the CPU
// profiler and the hottest functions (self time) are printed.
const [probe, profileMode] = (option('probe') ?? (existsSync(probeFile) ? readFileSync(probeFile, 'utf8').trim() : '')).split(/\s+/);

async function status(url) {
  try { const response = await fetch(url, { signal: AbortSignal.timeout(3000) }); return response.status; }
  catch (error) { return error.cause?.code || error.name; }
}
console.log('Vite localhost:5173 ->', await status('http://localhost:5173/'), '| 127.0.0.1:5173 ->', await status('http://127.0.0.1:5173/'));

let targets;
try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) })).json(); }
catch (error) { console.log(`No WebView DevTools on port ${port} (${error.cause?.code || error.message}). Start it with the dev-start task.`); process.exit(1); }

function session(url) {
  const socket = new WebSocket(url);
  let id = 0;
  const pending = new Map(), events = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    else if (message.method) events.push(message);
  });
  const opened = new Promise((done, fail) => { socket.addEventListener('open', done); socket.addEventListener('error', fail); });
  const send = (method, params = {}) => new Promise(done => { const key = ++id; pending.set(key, done); socket.send(JSON.stringify({ id: key, method, params })); });
  return { opened, send, events, close: () => socket.close() };
}
const text = value => value?.value ?? value?.description ?? value?.unserializableValue ?? value?.type;

const pages = targets.filter(target => target.type === 'page');
console.log(`${pages.length} page(s):`, pages.map(page => page.url).join(' | '));
for (const [index, page] of pages.entries()) {
  const devtools = session(page.webSocketDebuggerUrl);
  await devtools.opened;
  await Promise.all(['Runtime.enable', 'Log.enable', 'Page.enable'].map(method => devtools.send(method)));
  if (reload) await devtools.send('Page.reload', { ignoreCache: true });
  await new Promise(done => setTimeout(done, seconds * 1000));
  const state = await devtools.send('Runtime.evaluate', { returnByValue: true, expression: `({ href: location.href, readyState: document.readyState, title: document.title,
    rootChildren: document.querySelector('#root')?.children.length ?? null, size: [innerWidth, innerHeight], visibility: document.visibilityState,
    text: (document.body?.innerText || '').slice(0, 400),
    navigation: (({ startTime, domInteractive, domContentLoadedEventEnd, loadEventEnd }) => ({ domInteractive, domContentLoadedEventEnd, loadEventEnd }))(performance.getEntriesByType('navigation')[0] || {}),
    resources: performance.getEntriesByType('resource').length,
    lastResourceEnd: Math.round(Math.max(0, ...performance.getEntriesByType('resource').map(entry => entry.responseEnd))),
    slowest: performance.getEntriesByType('resource').sort((a, b) => b.duration - a.duration).slice(0, 8).map(entry => [Math.round(entry.startTime), Math.round(entry.duration), entry.name.replace(location.origin, '').slice(0, 90)]) })` });
  console.log(`\n# Page ${index}: ${page.title} ${page.url}`);
  console.log(JSON.stringify(state.result?.result?.value ?? state, null, 1));
  for (const event of devtools.events) {
    if (event.method === 'Runtime.consoleAPICalled') console.log(`console.${event.params.type}:`, event.params.args.map(text).join(' ').slice(0, 600));
    if (event.method === 'Runtime.exceptionThrown') { const detail = event.params.exceptionDetails; console.log('EXCEPTION:', (detail.exception?.description || detail.text).slice(0, 1200), detail.url || '', detail.lineNumber ?? ''); }
    if (event.method === 'Log.entryAdded') console.log(`log.${event.params.entry.level}:`, event.params.entry.text.slice(0, 600), event.params.entry.url || '');
  }
  if (probe && probes[probe] && page.url.includes('surface=folder') === false) {
    if (profileMode === 'profile') { await devtools.send('Profiler.enable'); await devtools.send('Profiler.setSamplingInterval', { interval: 200 }); await devtools.send('Profiler.start'); }
    const result = await devtools.send('Runtime.evaluate', { expression: probes[probe], awaitPromise: true, returnByValue: true });
    console.log(`probe ${probe}:`, JSON.stringify(result.result?.result?.value ?? result.result, null, 1));
    if (profileMode === 'profile') {
      const { profile } = (await devtools.send('Profiler.stop')).result;
      const self = new Map(), byId = new Map(profile.nodes.map(node => [node.id, node]));
      const interval = (profile.endTime - profile.startTime) / Math.max(1, profile.samples.length) / 1000;
      for (const id of profile.samples) { const { functionName, url, lineNumber } = byId.get(id).callFrame; const key = `${functionName || '(anonymous)'} ${url.replace(/^.*\/(?=[^/]+$)/, '').replace(/\?.*$/, '')}:${lineNumber + 1}`; self.set(key, (self.get(key) || 0) + interval); }
      // Inclusive time per React component-ish function: walk parents.
      const parent = new Map(); for (const node of profile.nodes) for (const child of node.children || []) parent.set(child, node.id);
      const total = new Map();
      for (const id of profile.samples) { const seen = new Set(); for (let at = id; at; at = parent.get(at)) { const { functionName, url, lineNumber } = byId.get(at).callFrame; if (!/\/src\//.test(url)) continue; const key = `${functionName || '(anonymous)'} ${url.replace(/^.*\/src\//, 'src/').replace(/\?.*$/, '')}:${lineNumber + 1}`; if (seen.has(key)) continue; seen.add(key); total.set(key, (total.get(key) || 0) + interval); } }
      const top = map => [...map].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([key, ms]) => `${Math.round(ms).toString().padStart(6)} ms  ${key}`).join('\n');
      console.log('Self time:\n' + top(self));
      console.log('Inclusive time in project sources:\n' + top(total));
    }
  }
  const shot = await devtools.send('Page.captureScreenshot', { format: 'png' });
  if (shot.result?.data) {
    const file = join(outputDirectory, `webview-${index}.png`);
    await writeFile(file, Buffer.from(shot.result.data, 'base64'));
    console.log('Screenshot:', file);
  }
  devtools.close();
}
