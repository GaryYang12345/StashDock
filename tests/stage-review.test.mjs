import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { canonicalReferenceUrl } from '../src/lib/reference-url.mjs';

const compiled = await build({ stdin: { contents: "export {canonicalizeUrl} from './src/lib/bookmarks'; export {canonicalUrl as mcpCanonical} from './plugins/stashdock/server/local-library.mjs'; export {filterItems,buildSearchIndex,uniqueImports} from './src/features/library/selectors';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'esm' });
const { canonicalizeUrl, mcpCanonical, filterItems, buildSearchIndex, uniqueImports } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const item = { id: 'saved', title: 'Saved', kind: 'web', source: 'Example', url: 'https://example.org/post', tags: ['Design'], createdAt: new Date().toISOString() };

test('reference identity removes the same trackers and preserves meaningful query data in every JS host', () => {
  for (const tracker of ['utm_source', 'UTM_CAMPAIGN', 'fbclid', 'gclid', 'dclid', 'mc_cid', 'mc_eid', 'igshid']) {
    const raw = `https://example.org/post///?id=42&${tracker}=tracking#reply`;
    assert.equal(canonicalReferenceUrl(raw), 'https://example.org/post?id=42');
    assert.equal(canonicalizeUrl(raw), canonicalReferenceUrl(raw));
    assert.equal(mcpCanonical(raw), canonicalReferenceUrl(raw));
  }
  assert.equal(uniqueImports([item], [{ ...item, id: 'incoming', url: item.url + '?igshid=tracking' }]).length, 0);
  for (const value of ['javascript:alert(1)', 'file:///private', 'https://user:secret@example.org']) assert.throws(() => canonicalReferenceUrl(value));
});

test('sidebar error headings describe the failed operation, not whether an old draft remains on screen', async () => {
  const source = await readFile(new URL('../src/features/browser-extension/Popup.tsx', import.meta.url), 'utf8');
  assert.match(source, /setErrorTitle\('Page could not be read'\)/);
  assert.match(source, /setErrorTitle\('Page could not be saved'\)/);
  assert.match(source, /title=\{errorTitle\}/);
  assert.doesNotMatch(source, /title=\{page \?/);
  assert.equal((source.match(/services\.tags\(\)/g) || []).length, 1);
});

test('desktop tag filtering matches the MCP case-insensitive contract without changing stored tag labels', () => {
  assert.deepEqual(filterItems([item], buildSearchIndex([item]), '', 'all', 'design'), [item]);
  assert.deepEqual(item.tags, ['Design']);
  assert.deepEqual(filterItems([item], buildSearchIndex([item]), '', 'all', 'other'), []);
});

test('extension asset regeneration is idempotent and its URL helper matches the canonical source', async () => {
  const path = new URL('../extension/ui/popup.js', import.meta.url);
  const before = await stat(path);
  execFileSync(process.execPath, ['scripts/sync-extension-ui.mjs'], { cwd: process.cwd(), stdio: 'pipe' });
  assert.equal((await stat(path)).mtimeMs, before.mtimeMs);
  assert.equal(await readFile(new URL('../extension/ui/reference-url.js', import.meta.url), 'utf8'), await readFile(new URL('../src/lib/reference-url.mjs', import.meta.url), 'utf8'));
});

test('stage review is explicitly human-triggered, and retired connector runtime is absent from active build paths', async () => {
  const rules = await readFile(new URL('../AGENTS.md', import.meta.url), 'utf8');
  assert.match(rules, /manual trigger only/);
  assert.match(rules, /Do not schedule it/);
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /DockView|\/dock/);
  for (const path of ['package.json', 'scripts/build-mcp-app.mjs', 'src-tauri/tauri.conf.json']) {
    assert.doesNotMatch(await readFile(new URL('../' + path, import.meta.url), 'utf8'), /connection-runtime|prepare-connection|deploy-x-prototype/);
  }
});
