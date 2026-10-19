import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { displayLibraryDirectory, libraryPathIdentity } from './library-location.mjs';

export function runStorageHelper(helper, request, timeout = 600_000, launch = spawn, signal) {
  if (signal?.aborted) return Promise.reject(Error('Storage operation cancelled.'));
  return new Promise((resolveResult, reject) => {
    const child = launch(helper, [], { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'ignore'] });
    let output = '', size = 0, failure;
    const stop = reason => { failure ||= reason; child.kill(); };
    const timer = setTimeout(() => stop(Error('Storage operation timed out.')), timeout);
    const cancel = () => stop(Error('Storage operation cancelled.'));
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    child.stdout.on('data', chunk => { size += chunk.length; if (size > 65536) stop(Error('Invalid storage response.')); else output += chunk; });
    child.stdin.on('error', error => { failure ||= error; });
    child.on('error', error => { failure ||= error; });
    child.once('close', code => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      if (failure || code !== 0) { reject(failure || Error('Storage operation could not finish.')); return; }
      try { const value = JSON.parse(output); if (value.error) throw Error(value.error); resolveResult(value); } catch (error) { reject(error); }
    });
    child.stdin.end(JSON.stringify(request));
  });
}
export function createStorageService(library, htmlUrl, { run, launch = spawn, now = Date.now } = {}) {
  const controller = new AbortController();
  const root = resolve(fileURLToPath(new URL('..', htmlUrl)));
  const helper = join(root, 'bin', `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'stashdock-storage.exe' : 'stashdock-storage');
  const execute = run || ((request, timeout) => {
    if (!existsSync(helper)) throw Error('Update the StashDock plugin to change storage.');
    return runStorageHelper(helper, request, timeout, spawn, controller.signal);
  });
  let chosen, active = false;
  const serial = async task => {
    if (controller.signal.aborted) throw Error('Storage is closed.');
    if (active) throw Error('Storage is busy. Try again.');
    active = true; try { return await task(); } finally { active = false; }
  };
  return {
    close: () => controller.abort(),
    choose: title => serial(async () => {
      chosen = undefined;
      const result = await execute({ operation: 'choose', title }, 290_000);
      if (result.path === null) return null;
      if (typeof result.path !== 'string' || !result.path || result.path.length > 32768) throw Error('Choose a storage folder.');
      chosen = { path: result.path, token: randomUUID(), until: now() + 600_000 };
      return { path: chosen.path, token: chosen.token };
    }),
    move: token => serial(async () => {
      if (!chosen || token !== chosen.token || chosen.until < now()) throw Error('Choose the storage folder again.');
      const result = await execute({ operation: 'move', source: library.dataDir, target: chosen.path }, 600_000);
      // Accessing the adapter follows the verified retired-database redirect.
      const path = library.dataDir;
      if (typeof result.path !== 'string' || libraryPathIdentity(path) !== libraryPathIdentity(result.path)) throw Error('Storage location could not be refreshed. Reopen StashDock.');
      chosen = undefined;
      return { path: displayLibraryDirectory(path) };
    }),
    open: async () => {
      const path = library.dataDir;
      const [command, args] = process.platform === 'win32' ? ['explorer.exe', [path]] : process.platform === 'darwin' ? ['open', [path]] : ['xdg-open', [path]];
      await new Promise((resolveResult, reject) => {
        const child = launch(command, args, { shell: false, windowsHide: true, detached: true, stdio: 'ignore' });
        child.once('error', () => reject(Error('The storage folder could not be opened.')));
        child.once('spawn', () => { child.unref(); resolveResult(); });
      });
      return { opened: true };
    },
  };
}
