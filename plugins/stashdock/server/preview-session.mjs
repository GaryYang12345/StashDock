// A bounded, serial helper session. Warmth belongs to a short work burst;
// cancellation kills only this owned child and never retries an ambiguous task.
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Independent serial sessions, selected by current load; all queued requests
// retain the same total deadline/cancellation guarantees as a single session.
export function createPreviewSessionPool(helper, size, options) {
  const sessions = Array.from({ length: size }, () => createPreviewSession(helper, options));
  const loads = sessions.map(() => 0);
  return {
    async run(...args) {
      const lane = loads.indexOf(Math.min(...loads));
      loads[lane]++;
      try { return await sessions[lane].run(...args); }
      finally { loads[lane]--; }
    },
    async close() { await Promise.all(sessions.map(session => session.close())); },
  };
}

export function createPreviewSession(helper, { launch = spawn, idleMs = 30_000, maximum = 8 } = {}) {
  let current, closed = false, nextId = 0, retiring = Promise.resolve();
  const queue = [];
  const settle = (task, error, value) => {
    clearTimeout(task.timer);
    task.signal?.removeEventListener('abort', task.cancel);
    if (error) task.reject(error); else task.resolve(value);
  };
  const retire = (state, error) => {
    if (state.dead) return state.done;
    state.dead = true; clearTimeout(state.idle);
    if (current === state) current = undefined;
    if (state.task) { settle(state.task, error || Error('Renderer stopped')); state.task = undefined; }
    // Hold admission until close and private-profile cleanup have completed.
    retiring = state.done;
    state.child.kill();
    return state.done;
  };
  const start = () => {
    const root = mkdtempSync(join(tmpdir(), 'stashdock-capture-owner-'));
    let child;
    try { child = launch(helper, ['--serve'], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'], env: { ...process.env, STASHDOCK_CAPTURE_PROFILE_ROOT: root } }); }
    catch (error) { retiring = rm(root, { recursive: true, force: true }).catch(() => {}); throw error; }
    let finish;
    const state = { child, decoder: new StringDecoder('utf8'), buffer: '', dead: false, task: undefined, done: new Promise(resolve => { finish = resolve; }) };
    current = state;
    child.stdout.on('data', chunk => {
      if (state.dead) return;
      state.buffer += state.decoder.write(chunk);
      // The protocol may publish both an early image and the final image. Bound
      // each line, not their combined stream across the lifetime of the child.
      while (state.buffer.includes('\n')) {
        const index = state.buffer.indexOf('\n');
        if (Buffer.byteLength(state.buffer.slice(0, index)) > 1_000_000) { retire(state, Error('Renderer result is too large')); return; }
        const line = state.buffer.slice(0, index); state.buffer = state.buffer.slice(index + 1);
        let message;
        try { message = JSON.parse(line); } catch { retire(state, Error('Invalid renderer result')); return; }
        const task = state.task;
        if (!task || message.id !== task.id) { retire(state, Error('Unexpected renderer result')); return; }
        if (message.event === 'images') {
          try { task.onImages?.(message.value); } catch (error) { retire(state, error); return; }
        } else if (Object.hasOwn(message, 'result')) {
          state.task = undefined; settle(task, undefined, message.result);
          state.idle = setTimeout(() => {
            if (current === state && !state.task && !queue.length) {
              // EOF lets the native pool release its job/profile before exit.
              current = undefined; retiring = state.done;
              state.child.stdin.end();
              state.idle = setTimeout(() => retire(state, Error('Renderer shutdown timed out')), 5000); state.idle.unref?.();
            }
          }, idleMs); state.idle.unref?.();
          pump();
        } else { retire(state, Error('Invalid renderer result')); return; }
      }
      if (Buffer.byteLength(state.buffer) > 1_000_000) retire(state, Error('Renderer result is too large'));
    });
    child.on('error', error => retire(state, error));
    child.stdin.on('error', error => retire(state, error));
    child.once('close', async () => {
      if (!state.dead) {
        state.dead = true; clearTimeout(state.idle);
        if (current === state) current = undefined;
        if (state.task) { settle(state.task, Error('Renderer stopped')); state.task = undefined; }
        retiring = state.done;
      }
      try { await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
      catch (error) { console.error('StashDock renderer cleanup:', error.message); }
      finally { finish(); pump(); }
    });
    return state;
  };
  let pumping = false;
  const pump = async () => {
    if (pumping || closed || current?.task || !queue.length) return;
    pumping = true;
    try {
      // A final result and a malformed trailing line can arrive in one pipe
      // chunk. Recheck the barrier if that line retired the child while this
      // dispatch was yielding; never overlap it with its replacement.
      for (;;) { const barrier = retiring; await barrier; if (barrier === retiring) break; }
      if (closed || current?.task || !queue.length) return;
      let state;
      try { state = current || start(); }
      catch (error) { while (queue.length) settle(queue.shift(), error); return; }
      clearTimeout(state.idle);
      const task = queue.shift(); state.task = task;
      try { state.child.stdin.write(JSON.stringify({ id: task.id, request: task.request }) + '\n'); }
      catch (error) { retire(state, error); }
    } finally { pumping = false; }
  };
  return {
    run(request, signal, { timeout = 55_000, onImages } = {}) {
      if (closed || signal?.aborted) return Promise.reject(Error('Renderer cancelled'));
      if (queue.length + Number(Boolean(current?.task)) >= maximum) return Promise.reject(Error('The renderer is busy. Retry in a moment.'));
      if (Buffer.byteLength(JSON.stringify(request)) > 149_000) return Promise.reject(Error('Capture request is too large'));
      return new Promise((resolve, reject) => {
        const task = { id: ++nextId, request, signal, timeout, onImages, resolve, reject };
        task.cancel = () => {
          const index = queue.indexOf(task);
          if (index >= 0) { queue.splice(index, 1); settle(task, Error('Renderer cancelled')); }
          else if (current?.task === task) retire(current, Error('Renderer cancelled'));
        };
        signal?.addEventListener('abort', task.cancel, { once: true });
        // Include queueing and prior-child cleanup in the task's total budget.
        task.timer = setTimeout(() => {
          const error = Error('Renderer timed out');
          const index = queue.indexOf(task);
          if (index >= 0) { queue.splice(index, 1); settle(task, error); }
          else if (current?.task === task) retire(current, error);
        }, timeout);
        queue.push(task); pump();
      });
    },
    async close() {
      closed = true;
      while (queue.length) settle(queue.shift(), Error('Renderer cancelled'));
      if (current) await retire(current, Error('Renderer cancelled'));
      await retiring;
    },
  };
}
