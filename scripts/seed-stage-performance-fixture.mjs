import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
const root = mkdtempSync(join(tmpdir(), 'stashdock-mcp-test-stage-perf-'));
const library = createLocalLibrary({ dataDir: root });
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
try {
  library.importItems(Array.from({ length: 67 }, (_, i) => ({ title: `Performance fixture ${i}`, kind: 'web', source: 'example.org', url: `https://example.org/${i}`, content: `Full fixture content ${i}`, tags: ['Fixture'], preview: pixel, origin: i === 66 ? {} : { faviconUrl: pixel } })));
} finally { library.close(); }
console.log(root);
