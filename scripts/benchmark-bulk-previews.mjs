// Isolated public-page comparison. Never reads bookmark URLs or the user's library.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
const before = resolve(process.argv[2] || 'artifacts/before-bulk-preview-20261020/stashdock-preview.exe');
const after = resolve(process.argv[3] || 'src-tauri/target/release/stashdock-preview.exe');
const faviconUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
async function measure(helper, label, round) {
  const started = performance.now();
  const child = spawn(helper, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, STASHDOCK_PREVIEW_DIAGNOSTICS: '1' } });
  let output = '', diagnostics = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-100_000); });
  const timeout = setTimeout(() => child.kill(), 95_000);
  try {
    const exit = new Promise((done, fail) => { child.once('error', fail); child.once('close', done); });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ url: 'https://example.org/', needPreview: true, faviconUrl }));
    const code = await exit;
    const data = JSON.parse(output || '{}');
    const resources = diagnostics.match(/Capture resources: (\{[^\n]+\})/);
    console.log(JSON.stringify({ label, round, milliseconds: Math.round(performance.now() - started), code, screenshot: Boolean(data.preview) && data.previewKind === 'screenshot', favicon: Boolean(data.faviconUrl), error: data.error, ...(resources ? JSON.parse(resources[1]) : {}) }));
  } finally { clearTimeout(timeout); }
}
for (let round = 0; round < 3; round++) {
  // Alternate order to avoid making only one version pay for first-use loading.
  const pair = round % 2 ? [[after, 'after'], [before, 'before']] : [[before, 'before'], [after, 'after']];
  for (const [helper, label] of pair) await measure(helper, label, round);
}
