import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { existsSync } from 'node:fs';
import { createPreviewHelperRunner } from '../plugins/stashdock/server/preview-helper.mjs';

function fixture(maximum = 2) {
  const children = [];
  const run = createPreviewHelperRunner({ maximum, launch: (_helper, _args, options) => {
    const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough();
    child.profileRoot = options.env.STASHDOCK_CAPTURE_PROFILE_ROOT;
    child.kill = () => { child.killed = true; }; children.push(child); return child;
  } });
  return { children, run: (signal, options) => run('fixture', { url: 'https://example.org' }, signal, options) };
}
test('helper slots stay reserved until the child actually exits, including aborts and output overflow', async () => {
  const f = fixture(), controller = new AbortController();
  const first = f.run(controller.signal), second = f.run(undefined, { maxOutput: 3 });
  const rejectedFirst = assert.rejects(first, /cancelled/), rejectedSecond = assert.rejects(second, /too large/);
  await assert.rejects(f.run(), /busy/);
  controller.abort(); f.children[1].stdout.write(Buffer.from('oversized'));
  assert.ok(f.children.every(c => c.killed));
  await assert.rejects(f.run(), /busy/);
  f.children[0].emit('close', 1); f.children[1].emit('close', 1);
  await rejectedFirst; await rejectedSecond;
  const next = f.run(); f.children[2].stdout.write(Buffer.from('{"ok":true}')); f.children[2].emit('close', 0);
  assert.deepEqual(await next, { ok: true });
});

test('parent removes its isolated scratch directory after forced child cancellation', async () => {
  const f = fixture(), controller = new AbortController();
  const pending = f.run(controller.signal), child = f.children[0];
  assert.ok(existsSync(child.profileRoot));
  controller.abort();
  const rejected = assert.rejects(pending, /cancelled/);
  child.emit('close', 1);
  await rejected;
  assert.equal(existsSync(child.profileRoot), false);
});
test('helper decodes UTF-8 across arbitrary pipe chunk boundaries', async () => {
  const f = fixture(), pending = f.run(), bytes = Buffer.from(JSON.stringify({ title: '中文标题 🖼️' }));
  for (const byte of bytes) f.children[0].stdout.write(Buffer.from([byte]));
  f.children[0].emit('close', 0);
  assert.equal((await pending).title, '中文标题 🖼️');
});
test('helper spawn failure releases its slot and a pre-aborted call starts no child', async () => {
  const f = fixture(), controller = new AbortController(); controller.abort();
  await assert.rejects(f.run(controller.signal), /cancelled/); assert.equal(f.children.length, 0);
  let failures = 0;
  const run = createPreviewHelperRunner({ maximum: 1, launch: () => { failures++; throw Error('Spawn failed'); } });
  await assert.rejects(run('', {}), /Spawn failed/); await assert.rejects(run('', {}), /Spawn failed/);
  assert.equal(failures, 2);
});
