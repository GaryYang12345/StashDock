import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorageService } from '../plugins/stashdock/server/storage-service.mjs';
import { displayLibraryDirectory, libraryPathIdentity } from '../plugins/stashdock/server/library-location.mjs';

test('Windows verbatim prefixes are presentation, not different storage locations', () => {
  assert.equal(displayLibraryDirectory('\\\\?\\C:\\Library'), 'C:\\Library');
  assert.equal(displayLibraryDirectory('\\\\?\\UNC\\server\\share\\Library'), '\\\\server\\share\\Library');
  if (process.platform === 'win32') assert.equal(libraryPathIdentity('\\\\?\\C:\\Library'), libraryPathIdentity('c:\\library'));
});

test('storage moves require the actual picker token, expire, serialize and follow the library adapter', async () => {
  const library = { dataDir: 'D:/Fixture/Original' }, requests = [];
  let now = 0, finish;
  const service = createStorageService(library, new URL('../plugins/stashdock/web/shelf.html', import.meta.url), {
    now: () => now,
    run: async request => {
      requests.push(request);
      if (request.operation === 'choose') return new Promise(resolve => { finish = () => resolve({ path: 'D:/Fixture/New' }); });
      library.dataDir = request.target; return { path: request.target };
    },
  });
  await assert.rejects(service.move('forged'), /Choose the storage folder again/);
  const selecting = service.choose('Choose an empty folder');
  await assert.rejects(service.choose('another'), /busy/); finish();
  const selected = await selecting;
  await assert.rejects(service.move('forged'), /Choose the storage folder again/);
  now = 600001; await assert.rejects(service.move(selected.token), /again/);
  const choosing = service.choose('Choose an empty folder'); finish(); const next = await choosing;
  assert.equal((await service.move(next.token)).path, 'D:/Fixture/New');
  assert.deepEqual(requests.at(-1), { operation: 'move', source: 'D:/Fixture/Original', target: 'D:/Fixture/New' });
  await assert.rejects(service.move(next.token), /again/);
});

test('cancelling the picker neither moves data nor authorizes a later move', async () => {
  const service = createStorageService({ dataDir: 'D:/Fixture/Original' }, new URL('../plugins/stashdock/web/shelf.html', import.meta.url), { run: async () => ({ path: null }) });
  assert.equal(await service.choose('Choose an empty folder'), null);
  await assert.rejects(service.move('anything'), /again/);
});
