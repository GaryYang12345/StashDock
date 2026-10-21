import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { existsSync } from 'node:fs';
import { setImmediate as turn } from 'node:timers/promises';
import { createPreviewSession, createPreviewSessionPool } from '../plugins/stashdock/server/preview-session.mjs';

test('four reusable content sessions keep their concurrency bound and drain queued reads', async () => {
  const children = [];
  const pool = createPreviewSessionPool('fixture', 4, { launch(_exe, _args, options) {
    const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.requests = [];
    child.root = options.env.STASHDOCK_CAPTURE_PROFILE_ROOT;
    child.stdin.on('data', line => child.requests.push(JSON.parse(line)));
    child.kill = () => {}; children.push(child); return child;
  } });
  const reply = child => child.stdout.write(JSON.stringify({ id: child.requests.at(-1).id, result: { title: 'Read', content: 'Body' } }) + '\n');
  const pending = Array.from({ length: 5 }, (_, index) => pool.run({ url: `https://example.org/${index}`, contentOnly: true }));
  await until(() => children.length === 4 && children.every(child => child.requests.length === 1));
  reply(children[0]);
  await until(() => children[0].requests.length === 2);
  for (const child of children) reply(child);
  assert.equal((await Promise.all(pending)).length, 5);
  assert.equal(children.length, 4);
  const closed = pool.close(); for (const child of children) child.emit('close', 0); await closed;
  assert.ok(children.every(child => !existsSync(child.root)));
  await assert.rejects(pool.run({ url: 'https://example.org/', contentOnly: true }), /cancelled/);
});
async function until(predicate) {
  const deadline = Date.now() + 3000;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(predicate(), 'bounded fixture wait');
}

function fixture(options = {}) {
  const children = [];
  const session = createPreviewSession('fixture', { ...options, launch: (_exe, args, settings) => {
    assert.deepEqual(args, ['--serve']); assert.equal(settings.windowsHide, true);
    const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough();
    child.root = settings.env.STASHDOCK_CAPTURE_PROFILE_ROOT; child.requests = [];
    child.stdin.on('data', line => child.requests.push(JSON.parse(line)));
    child.kill = () => { child.killed = true; }; children.push(child); return child;
  } });
  const reply = (child, value, event) => child.stdout.write(JSON.stringify({ id: child.requests.at(-1).id, ...(event ? { event, value } : { result: value }) }) + '\n');
  const finish = async () => { const close = session.close(); for (const child of children) child.emit('close', 0); await close; };
  return { session, children, reply, finish };
}
test('warm helper reuses one child and publishes an image before final completion', async () => {
  const f = fixture(), progress = [];
  const a = f.session.run({ url: 'https://example.org' }, undefined, { onImages: image => progress.push(image) });
  await turn(); const child = f.children[0];
  f.reply(child, { preview: 'early' }, 'images'); assert.deepEqual(progress, [{ preview: 'early' }]);
  f.reply(child, { title: '中文' }); assert.equal((await a).title, '中文');
  const b = f.session.run({ url: 'https://example.com' }); await turn();
  assert.equal(f.children.length, 1); assert.equal(child.requests.length, 2);
  f.reply(child, { ok: true }); assert.deepEqual(await b, { ok: true });
  await f.finish(); assert.equal(existsSync(child.root), false);
});
test('cancelled active session retains admission until child close, never replays it', async () => {
  const f = fixture(), controller = new AbortController();
  const a = f.session.run({ url: 'https://example.org' }, controller.signal);
  const rejection = assert.rejects(a, /cancelled/); await turn(); controller.abort(); await rejection;
  const b = f.session.run({ url: 'https://example.com' }); await turn();
  assert.equal(f.children.length, 1); assert.equal(f.children[0].killed, true);
  f.children[0].emit('close', 1); await until(() => f.children.length === 2);
  assert.equal(f.children.length, 2); f.reply(f.children[1], { ok: true }); await b;
  await f.finish();
});
test('queued cancellation, admission and malformed output are bounded', async () => {
  const f = fixture({ maximum: 2 }), controller = new AbortController();
  const a = f.session.run({ url: 'https://example.org' }); const failure = assert.rejects(a, /Invalid/);
  const b = f.session.run({ url: 'https://example.com' }, controller.signal); const cancelled = assert.rejects(b, /cancelled/);
  await assert.rejects(f.session.run({ url: 'https://example.net' }), /busy/);
  controller.abort(); await cancelled; await turn();
  f.children[0].stdout.write('not json\n'); await failure;
  await f.finish();
  await assert.rejects(f.session.run({}), /cancelled/);
});

test('a task waiting behind a retiring child still has a total deadline', async () => {
  const f=fixture(), controller=new AbortController();
  const first=f.session.run({url:'https://example.org/'},controller.signal);
  const cancelled=assert.rejects(first,/cancelled/); await turn();controller.abort();await cancelled;
  const queued=f.session.run({url:'https://example.com/'},undefined,{timeout:15});
  await assert.rejects(queued,/timed out/);
  assert.equal(f.children.length,1,'A blocked cleanup cannot create an extra renderer');
  await f.finish();
});
test('idle shutdown waits for profile cleanup before a new request starts', async () => {
  const f = fixture({ idleMs: 5 });
  const a = f.session.run({ url: 'https://example.org' }); await turn(); f.reply(f.children[0], {}); await a;
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(f.children[0].stdin.writableEnded, true);
  const b = f.session.run({ url: 'https://example.com' }); await turn(); assert.equal(f.children.length, 1);
  f.children[0].emit('close', 0); await until(() => f.children.length === 2);
  f.reply(f.children[1], {}); await b; await f.finish();
});

test('UTF-8 survives pipe chunk boundaries and oversize output terminates only the owned helper', async () => {
  const f = fixture();
  const a = f.session.run({ url: 'https://example.org' }); await turn();
  const child = f.children[0], bytes = Buffer.from(JSON.stringify({ id: child.requests[0].id, result: { title: '中文 🖼️' } }) + '\n');
  for (const byte of bytes) child.stdout.write(Buffer.from([byte]));
  assert.equal((await a).title, '中文 🖼️');
  const b = f.session.run({ url: 'https://example.com' }); const rejected = assert.rejects(b, /too large/); await turn();
  child.stdout.write('x'.repeat(1_000_001)); await rejected; assert.equal(child.killed, true);
  await f.finish();
});
test('request timeout terminates its child without replaying the request', async () => {
  const f = fixture();
  const pending = f.session.run({ url: 'https://example.org' }, undefined, { timeout: 5 });
  await assert.rejects(pending, /timed out/);
  assert.equal(f.children.length, 1); assert.equal(f.children[0].killed, true);
  await f.finish();
});
test('malformed trailing data cannot start a replacement before the old child closes', async () => {
  const f = fixture();
  const a = f.session.run({ url: 'https://example.org' });
  const b = f.session.run({ url: 'https://example.com' });
  await turn(); const child = f.children[0];
  child.stdout.write(JSON.stringify({ id: child.requests[0].id, result: {} }) + '\ninvalid\n');
  await a; await turn(); assert.equal(f.children.length, 1); assert.ok(child.killed);
  child.emit('close', 1); await until(() => f.children.length === 2);
  f.reply(f.children[1], {}); await b; await f.finish();
});
