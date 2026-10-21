// Explicit public URLs only; does not inspect or modify a collection.
import { spawn } from 'node:child_process';
import { resolve, join, basename, dirname } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createPreviewSession } from '../plugins/stashdock/server/preview-session.mjs';

const helper = resolve(process.argv[2]);
const urls = process.argv.slice(3);
if (!urls.length) throw Error('Supply public test URLs explicitly.');
const diagnostics = [];
let sampleStarted = performance.now();
const session = createPreviewSession(helper, { launch(command, args, options) {
  const child = spawn(command, args, { ...options, env: { ...options.env, STASHDOCK_PREVIEW_DIAGNOSTICS: '1' }, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.on('data', chunk => { diagnostics.push(`${Math.round(performance.now() - sampleStarted)}ms: ${chunk}`); if (diagnostics.length > 100) diagnostics.shift(); });
  return child;
} });
try {
  for (const url of urls) for (let attempt = 1; attempt <= 2; attempt++) {
    diagnostics.length = 0;
    const started = performance.now();
    sampleStarted = started;
    try {
      const result = await session.run({ url, needPreview: true, faviconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' }, undefined, { timeout: 55_000 });
      let imagePath;
      if (result.previewKind === 'screenshot' && /^data:image\/jpeg;base64,/.test(result.preview || '')) {
        const directory = resolve('output/preview-transport-images');
        await mkdir(directory, { recursive: true });
        imagePath = join(directory, `${basename(dirname(helper)).replace(/[^\w-]/g, '-')}-${new URL(url).hostname.replace(/[^\w.-]/g, '-')}.jpg`);
        await writeFile(imagePath, Buffer.from(result.preview.split(',')[1], 'base64'));
      }
      console.log(JSON.stringify({ url, attempt, milliseconds: Math.round(performance.now() - started), kind: result.previewKind, imageBytes: result.preview?.length || 0, imagePath, error: result.error, diagnostics: diagnostics.join('').slice(-6000) }));
      if (result.preview) break;
    } catch (error) { console.log(JSON.stringify({ url, attempt, milliseconds: Math.round(performance.now() - started), error: error.message, diagnostics: diagnostics.join('').slice(-6000) })); }
  }
} finally { await session.close(); }
