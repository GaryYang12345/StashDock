import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createPreviewCache } from '../plugins/stashdock/server/preview-cache.mjs';
import { runPreviewHelper } from '../plugins/stashdock/server/preview-worker.mjs';
import { writeIfChanged } from '../scripts/lib/write-if-changed.mjs';
import { mkdtemp, rm, stat, utimes, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const bundle = await build({ stdin: { contents: "export * from './src/lib/reconcileReferences'; export * from './src/features/mcp-app/readPreviewPages';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' });
const module = { exports: {} };
new Function('module', 'exports', bundle.outputFiles[0].text)(module, module.exports);
const { reconcileReferences, readPreviewPages } = module.exports;
const item = (id, extra = {}) => ({ id, title: id, source: 'Test', kind: 'note', tags: ['Test'], excerpt: '', createdAt: '2026-10-12', ...extra });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('unchanged generated assets retain mtime; changed content is replaced', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'stashdock-asset-audit-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const path = join(dir, 'fixture.txt');
  assert.equal(await writeIfChanged(path, 'original'), true);
  await utimes(path, new Date(1000), new Date(1000));
  const before = (await stat(path)).mtimeMs;
  assert.equal(await writeIfChanged(path, Buffer.from('original')), false);
  assert.equal((await stat(path)).mtimeMs, before);
  assert.equal(await writeIfChanged(path, 'changed'), true);
  assert.equal(await readFile(path, 'utf8'), 'changed');
});

test('both stores retain equal rows and arrays; preview updates preserve loaded order', () => {
  const rows = [item('a'), item('b')];
  assert.equal(reconcileReferences(rows, structuredClone(rows)), rows);
  const next = reconcileReferences(rows, [item('b', { preview: 'new' })], 'update');
  assert.equal(next[0], rows[0]); assert.equal(next[1].preview, 'new');
  assert.equal(reconcileReferences(next, [item('missing')], 'update'), next);
  assert.deepEqual(reconcileReferences(rows, [item('b'), item('c'), item('c')], 'append').map(row => row.id), ['a', 'b', 'c']);
  assert.deepEqual(reconcileReferences(rows, [item('b'), item('a')]).map(row => row.id), ['b', 'a']);
  assert.notEqual(reconcileReferences(rows, [item('a', { tags: ['Changed'] }), item('b')])[0], rows[0]);
});

test('stale preview pagination stops after the current request, without fetching later pages', async () => {
  let current = true; const calls = [], flight = deferred();
  const task = readPreviewPages(90, offset => { calls.push(offset); return flight.promise; }, () => current);
  current = false; flight.resolve([item('a')]);
  assert.equal(await task, null); assert.deepEqual(calls, [0]);
  const result = await readPreviewPages(61, async offset => { calls.push(offset); return [item(String(offset))]; }, () => true);
  assert.deepEqual(result.map(row => row.id), ['0', '30', '60']);
});

test('preview cache keeps pending oldest requests during eviction and TTL expiry', async () => {
  let clock = 0; const active = deferred(), calls = [];
  const cache = createPreviewCache(url => { calls.push(url); return url === 'active' ? active.promise : Promise.resolve(url); }, { now: () => clock, maxEntries: 3, ttl: 10 });
  const first = cache.lookup('active');
  await cache.lookup('a'); await cache.lookup('b'); await cache.lookup('c');
  clock = 100;
  const repeated = cache.lookup('active'); active.resolve('image');
  assert.equal(await first, 'image'); assert.equal(await repeated, 'image');
  assert.equal(calls.filter(url => url === 'active').length, 1);
  cache.close(); await assert.rejects(cache.lookup('later'), /cancelled/);
});

test('preview concurrency has a hard bound; failed entries can retry and close cannot launch work', async () => {
  const flight = deferred(); let calls = 0;
  const cache = createPreviewCache(() => { calls++; return flight.promise; });
  const a = cache.lookup('a'), b = cache.lookup('b');
  await assert.rejects(cache.lookup('c'), /busy/);
  flight.resolve('done'); await Promise.all([a, b]); assert.equal(calls, 2);
  let failed = true;
  const retry = createPreviewCache(async () => { if (failed) throw Error('offline'); return 'ok'; });
  await assert.rejects(retry.lookup('a'), /offline/); failed = false; assert.equal(await retry.lookup('a'), 'ok');
  let started = false; const closing = createPreviewCache(() => { started = true; });
  const task = closing.lookup('x'); closing.close(); await assert.rejects(task, /cancelled/); assert.equal(started, false);
  const signal = AbortSignal.abort(); await assert.rejects(runPreviewHelper('missing-executable', {}, signal), /cancelled/);
  cache.close(); retry.close();
});
