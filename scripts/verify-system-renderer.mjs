// Real Windows rendering; no library writes or normal browser profiles.
import assert from 'node:assert/strict';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { runPreviewHelper } from '../plugins/stashdock/server/preview-helper.mjs';
const helper = resolve(process.argv[2] || 'src-tauri/target/release/stashdock-preview.exe');
const folder = resolve('output/system-renderer');
await mkdir(folder, { recursive: true });
const profiles = async () => new Set((await readdir(tmpdir())).filter(name => name.startsWith('stashdock-capture-')));
const before = await profiles();
const results = [];
for (const [name, job] of [
  ['example', { url: 'https://example.org/' }],
  ['rust', { url: 'https://www.rust-lang.org/' }],
  ['pdf', { url: 'https://arxiv.org/pdf/2505.22954', lookup: true }],
  ['example-repeat', { url: 'https://example.org/' }],
]) {
  const started = performance.now();
  const data = await runPreviewHelper(helper, job, undefined, { timeout: 95_000 });
  assert.equal(data.error ?? null, null, `${name}: ${data.error}`);
  assert.ok(data.preview?.startsWith('data:image/jpeg;base64,'), `${name}: missing JPEG`);
  if (!job.lookup) assert.equal(data.previewKind, 'screenshot', `${name}: a cover fallback is not a screenshot`);
  const bytes = Buffer.from(data.preview.split(',')[1], 'base64');
  assert.ok(bytes.length > 1000, `${name}: unexpectedly small image`);
  await writeFile(resolve(folder, `${name}.jpg`), bytes);
  if (job.lookup) { assert.match(data.title, /Darwin|G[oö]del/i); assert.ok(data.content.length > 1000); }
  const result = { name, milliseconds: Math.round(performance.now() - started), imageBytes: bytes.length, title: data.title, textLength: data.content?.length };
  results.push(result); console.log(JSON.stringify(result));
}
for (const url of ['http://127.0.0.1/', 'file:///C:/Windows/win.ini']) {
  const data = await runPreviewHelper(helper, { url });
  assert.ok(data.error && !data.preview, 'Private or file URL was accepted');
}
const cancel = new AbortController();
const timer = setTimeout(() => cancel.abort(), 1500);
await assert.rejects(runPreviewHelper(helper, { url: 'https://example.org/' }, cancel.signal), /cancelled/);
clearTimeout(timer);
const after = await profiles();
const leftoverProfiles = [...after].filter(name => !before.has(name));
const report = { helper, results, privateUrlsRejected: true, cancellation: true, leftoverProfiles };
assert.deepEqual(leftoverProfiles, [], 'Renderer left new temporary profiles behind');
await writeFile(resolve(folder, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
