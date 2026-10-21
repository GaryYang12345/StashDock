import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { search } from '../plugins/stashdock/server/library.mjs';
import { matchesSearchTerms, referenceSearchText, searchTerms } from '../src/lib/reference-search.mjs';

// The same fixture runs against Desktop's Rust index (src-tauri/src/library/search.rs).
const contract = JSON.parse(readFileSync(new URL('./fixtures/search-contract.json', import.meta.url), 'utf8'));
const sorted = ids => [...ids].sort();

function withLibrary(callback) {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-search-contract-'));
  const library = createLocalLibrary({ dataDir: root });
  const db = new DatabaseSync(join(root, 'stashdock.sqlite3'));
  try {
    const insert = db.prepare(`INSERT INTO stash_items(id,title,kind,source,url,excerpt,tags_json,created_at,asset_path,content,context_override,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
    contract.items.forEach((item, index) => insert.run(item.id, item.title, item.kind, item.source, item.url ?? null, item.excerpt,
      JSON.stringify(item.tags), new Date(Date.UTC(2026, 0, 1 + index)).toISOString(), item.assetPath ?? null, item.content ?? null, item.contextOverride ?? null, 'now'));
    return callback(library, db);
  } finally { db.close(); library.close(); rmSync(root, { recursive: true, force: true }); }
}

test('the SQLite index and the in-memory fallback return the same references for every contract query', () => {
  withLibrary(library => {
    for (const { query, ids } of contract.cases) {
      assert.deepEqual(sorted(library.searchIds(query)), sorted(ids), `index: ${query}`);
      const terms = searchTerms(query);
      assert.deepEqual(sorted(contract.items.filter(item => matchesSearchTerms(referenceSearchText(item), terms)).map(item => item.id)), sorted(ids), `memory: ${query}`);
    }
    assert.equal(library.searchIds('   '), null);
  });
});

test('the index follows every write path, including later edits, tag changes and deletion', () => {
  withLibrary((library, db) => {
    db.prepare("UPDATE stash_items SET title='机器学习手册' WHERE id='zh-title'").run();
    assert.deepEqual(library.searchIds('机器'), ['zh-title']);
    assert.deepEqual(library.searchIds('深度'), []);
    db.prepare("UPDATE stash_items SET tags_json='[\"研究\"]' WHERE id='tagged'").run();
    assert.deepEqual(library.searchIds('研究'), ['tagged']);
    db.prepare("UPDATE stash_items SET preview='data:image/png;base64,YQ==' WHERE id='tagged'").run();
    assert.equal(db.prepare("SELECT count(*) AS n FROM stash_fts WHERE id='tagged'").get().n, 1);
    db.prepare("DELETE FROM stash_items WHERE id='tagged'").run();
    assert.deepEqual(library.searchIds('研究'), []);
    assert.equal(db.prepare('SELECT count(*) AS n FROM stash_fts').get().n, contract.items.length - 1);
  });
});

test('MCP search ranks by relevance, keeps collection/tag filters and pages after filtering', () => {
  withLibrary(library => {
    const rows = contract.items.map((item, index) => ({ ...item, createdAt: new Date(Date.UTC(2026, 0, 1 + index)).toISOString() }));
    const rankedIds = library.searchIds('example.org');
    const all = search(rows, { query: 'example.org', rankedIds, limit: 50 });
    assert.deepEqual(all.items.map(item => item.id), rankedIds);
    assert.deepEqual(search(rows, { query: 'example.org', rankedIds, tag: '设计' }).items.map(item => item.id), ['tagged']);
    const page = search(rows, { query: 'example.org', rankedIds, limit: 2, offset: 2 });
    assert.deepEqual(page.items.map(item => item.id), rankedIds.slice(2, 4));
    assert.equal(page.hasMore, false);
  });
});

test('an existing unicode61 library is rebuilt once into the shared trigram index', () => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-search-upgrade-'));
  try {
    const legacy = new DatabaseSync(join(root, 'stashdock.sqlite3'));
    legacy.exec(readFileSync(new URL('../plugins/stashdock/server/schema.sql', import.meta.url), 'utf8'));
    legacy.exec("CREATE VIRTUAL TABLE stash_fts USING fts5(id UNINDEXED, title, source, excerpt, tags, content, tokenize='unicode61', prefix='2 3')");
    legacy.exec("INSERT INTO stash_items(id,title,kind,source,excerpt,tags_json,created_at,updated_at) VALUES('old','深度学习入门教程','web','Example','','[]','2026-01-01T00:00:00Z','now')");
    legacy.exec("INSERT INTO stash_fts SELECT id,title,source,excerpt,tags_json,'' FROM stash_items");
    legacy.exec("INSERT INTO app_meta(key,value) VALUES('fts_initialized_v1','1')");
    legacy.close();
    const library = createLocalLibrary({ dataDir: root });
    try { assert.deepEqual(library.searchIds('学习'), ['old']); } finally { library.close(); }
    const db = new DatabaseSync(join(root, 'stashdock.sqlite3'));
    try {
      assert.match(db.prepare("SELECT sql FROM sqlite_master WHERE name='stash_fts'").get().sql, /trigram/);
      assert.equal(db.prepare('SELECT count(*) AS n FROM stash_fts').get().n, 1);
    } finally { db.close(); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('Desktop shows the same immediate in-memory result as its index, so results do not flicker away', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild');
  const { fileURLToPath } = await import('node:url');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const result = await build({ stdin: { contents: "export * from './src/features/library/selectors';", resolveDir: root, loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'neutral', logLevel: 'silent' });
  const module = { exports: {} };
  new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports);
  const { buildSearchIndex, filterItems } = module.exports;
  const items = contract.items.map(item => ({ ...item, createdAt: '2026-01-01T00:00:00Z' }));
  const index = buildSearchIndex(items);
  for (const { query, ids } of contract.cases) {
    assert.deepEqual(sorted(filterItems(items, index, query, 'all').map(item => item.id)), sorted(ids), query);
    // Once the index answers, its order is kept and nothing else is mixed in.
    assert.deepEqual(filterItems(items, index, query, 'all', null, new Set([...ids].reverse())).map(item => item.id), [...ids].reverse(), query);
  }
});
