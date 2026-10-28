import test from 'node:test';
import assert from 'node:assert/strict';
import { createSafariFetcher } from '../extension/safari-provider.js';

test('Safari forwards authenticated JSON lookup and tag reads through its fixed native host', async () => {
  const calls = [];
  const fetch = createSafariFetcher({ runtime: { sendNativeMessage: async (...args) => {
    calls.push(args);
    return { status: 200, body: JSON.stringify({ tags: ['Research'] }) };
  } } });
  for (const [path, body] of [['/v1/tags', '{}'], ['/v1/capture/lookup', '{"url":"https://example.org"}']]) {
    const response = await fetch(`http://127.0.0.1:17863${path}`, { method: 'POST', body });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { tags: ['Research'] });
    assert.deepEqual(calls.at(-1), ['app.stashdock.desktop', { method: 'POST', path, body, port: 17863 }]);
  }
  const count = calls.length;
  for (const [url, options] of [
    ['https://example.org/v1/tags', { method: 'POST' }],
    ['http://127.0.0.1:17863/v1/items', { method: 'POST' }],
    ['http://127.0.0.1:17863/v1/tags', { method: 'DELETE' }],
    ['http://127.0.0.1:17863/v1/tags', { method: 'POST', body: 'x'.repeat(1_000_001) }],
  ]) await assert.rejects(fetch(url, options), /Invalid StashDock/);
  assert.equal(calls.length, count, 'invalid requests never reach the native host');
});

test('Safari preserves the selected Desktop or plugin provider without replaying Save', async () => {
  const calls = [];
  const fetcher = createSafariFetcher({ runtime: { sendNativeMessage: async (_host, message) => {
    calls.push(message);
    return { status: message.port === 17864 ? 503 : 200, body: '{}' };
  } } });
  for (const port of [17864, 17863]) {
    const response = await fetcher(`http://127.0.0.1:${port}/v1/capture`, { method: 'POST', body: '{}' });
    assert.equal(response.status, port === 17864 ? 503 : 200);
  }
  assert.deepEqual(calls.map(value => value.port), [17864, 17863]);
  const count = calls.length;
  for (const port of [17862, 17865, 80]) await assert.rejects(fetcher(`http://127.0.0.1:${port}/v1/health`), /Invalid/);
  await assert.rejects(fetcher('http://127.0.0.1:17864/v1/capture', { method: 'POST', body: '中'.repeat(333334) }), /Invalid/);
  await assert.rejects(fetcher('http://127.0.0.1:17864/v1/capture', { method: 'POST', body: {} }), /Invalid/);
  assert.equal(calls.length, count);
});
