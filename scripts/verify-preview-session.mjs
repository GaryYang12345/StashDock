// Read-only public-page acceptance. Never reads the user's collection/browser.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { runPreviewHelper } from '../plugins/stashdock/server/preview-helper.mjs';

const helper = resolve(process.argv[2] || 'src-tauri/target/debug/stashdock-preview.exe');
const root = await mkdtemp(join(tmpdir(), 'stashdock-session-verify-'));
const child = spawn(helper, ['--serve'], { windowsHide: true, stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, STASHDOCK_CAPTURE_PROFILE_ROOT: root, STASHDOCK_CAPTURE_DIAGNOSTICS: '1' } });
const exited = once(child, 'close');
let id = 0, task;
const lines = createInterface({ input: child.stdout });
lines.on('line', line => {
  assert.ok(Buffer.byteLength(line) <= 1_000_000);
  const message = JSON.parse(line);
  assert.equal(message.id, task.id);
  if (message.event === 'images') { task.firstImageMs ??= Math.round(performance.now() - task.start); return; }
  task.resolve({ ...message, ms: Math.round(performance.now() - task.start), firstImageMs: task.firstImageMs });
});
const run = request => new Promise(resolve => {
  task = { id: ++id, start: performance.now(), resolve };
  child.stdin.write(JSON.stringify({ id, request }) + '\n');
});
const timeout = setTimeout(() => child.kill(), 240_000);
child.once('close', () => task?.resolve({ result: { error: 'Helper stopped' } }));
try {
  const results = [];
  for (const url of ['https://example.org/?stashdock-warm=1', 'https://example.com/?stashdock-warm=2', 'https://www.rust-lang.org/learn?stashdock-warm=3']) {
    const result = await run({ url, needPreview: true, faviconUrl: 'data:image/png;base64,YQ==' });
    assert.equal(result.result.error, undefined, result.result.error);
    assert.equal(result.result.previewKind, 'screenshot', `Real screenshot required: ${url}`);
    assert.ok(result.result.preview.length > 1000);
    results.push({ url, ms: result.ms, firstImageMs: result.firstImageMs, renderer: result.renderer, bytes: result.result.preview.length, hash: createHash('sha256').update(result.result.preview).digest('hex').slice(0, 16) });
  }
  assert.equal(results.at(-1).renderer.created, 1, 'Only one browser should start during this work burst');
  assert.equal(results.at(-1).renderer.reused, 2, 'Two separate navigations must reset and reuse it');
  const url = 'https://www.rust-lang.org/learn';
  const text = await run({ url, contentOnly: true });
  const full = await run({ url, lookup: true });
  assert.equal(text.result.error, undefined); assert.equal(full.result.error, undefined);
  assert.ok(text.result.content.length > 100, 'The parity sample needs real readable text');
  assert.equal(text.result.content, full.result.content, 'Bookmark and pasted-link content must match exactly');
  console.log(JSON.stringify({ warm: results, contentParity: { url, chars: text.result.content.length, exact: true } }, null, 2));
  if (process.argv[3]) {
    const cold = [];
    for (const entry of results) {
      const start = performance.now();
      const result = await runPreviewHelper(resolve(process.argv[3]), { url: entry.url, faviconUrl: 'data:image/png;base64,YQ==' }, undefined, { timeout: 95_000 });
      assert.equal(result.previewKind, 'screenshot');
      cold.push({ url: entry.url, ms: Math.round(performance.now() - start), bytes: result.preview.length });
    }
    console.log(JSON.stringify({ cold }, null, 2));
  }
} finally {
  child.stdin.end();
  const kill = setTimeout(() => child.kill(), 15_000);
  await exited;
  clearTimeout(kill); clearTimeout(timeout); lines.close();
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
