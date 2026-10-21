// Explicit public URLs and aggregate timings only, no library access.
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { createPreviewSession } from '../plugins/stashdock/server/preview-session.mjs';
const helper = resolve(process.argv[2]), urls = process.argv.slice(3);
if (!urls.length) throw Error('Supply public test URLs explicitly.');
const session = createPreviewSession(helper);
try {
  for (const url of urls) {
    const start = performance.now();
    try {
      const result = await session.run({ url, contentOnly: true }, undefined, { timeout: 50_000 });
      console.log(JSON.stringify({ url, milliseconds: Math.round(performance.now() - start), titleLength: result.title?.length, contentLength: result.content?.length, hasPreview: Boolean(result.preview), error: result.error }));
    } catch (error) { console.log(JSON.stringify({ url, milliseconds: Math.round(performance.now() - start), error: error.message })); }
  }
} finally { await session.close(); }
