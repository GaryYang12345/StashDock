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
const outputDirectory = resolve(option('out', 'output/claude-review'));
await mkdir(outputDirectory, { recursive: true });

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
  const shot = await devtools.send('Page.captureScreenshot', { format: 'png' });
  if (shot.result?.data) {
    const file = join(outputDirectory, `webview-${index}.png`);
    await writeFile(file, Buffer.from(shot.result.data, 'base64'));
    console.log('Screenshot:', file);
  }
  devtools.close();
}
