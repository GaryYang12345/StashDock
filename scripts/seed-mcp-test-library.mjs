// Isolated visual fixture based on six existing references. No user-library writes.
import { mkdirSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
const base = resolve('output/playwright'); mkdirSync(base, { recursive: true });
const dataDir = mkdtempSync(join(base, 'mcp-test-'));
const original = createLocalLibrary();
let rows;
try { rows = (await original.read()).filter(item => ['web', 'repo'].includes(item.kind)).slice(0, 6); }
finally { original.close(); }
const fixture = createLocalLibrary({ dataDir });
try {
  if (rows.length) fixture.importItems(rows);
  else fixture.importItems([{ title: 'Example reference (test fixture)', kind: 'web', source: 'Example', url: 'https://example.test/', excerpt: 'Test fixture', tags: ['Design'], createdAt: new Date().toISOString() }]);
} finally { fixture.close(); }
console.log(dataDir);
