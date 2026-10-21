// Shared full-text index lifecycle and query execution for the MCP server.
// Desktop runs the same search-index.sql (src-tauri/src/library/search.rs).
import { readFileSync } from 'node:fs';
import { searchStatement, searchTerms } from '../../../src/lib/reference-search.mjs';

let statements;
const indexSql = () => (statements ??= readFileSync(new URL('../server/search-index.sql', import.meta.url), 'utf8').split('-- rebuild'));
export const SEARCH_INDEX_KEY = 'fts_trigram_v1';

/** Create the trigram index and its triggers; rebuild once when upgrading. Call inside a write transaction. */
export function prepareSearchIndex(db) {
  const ready = Boolean(db.prepare('SELECT 1 FROM app_meta WHERE key=?').get(SEARCH_INDEX_KEY));
  const [definition, rebuild] = indexSql();
  if (!ready) db.exec('DROP TABLE IF EXISTS stash_fts');
  db.exec(definition);
  if (ready) return;
  db.exec(rebuild);
  db.prepare('INSERT OR REPLACE INTO app_meta(key,value) VALUES (?,?)').run(SEARCH_INDEX_KEY, '1');
}

/** Ordered matching IDs, or null when the query has no terms. */
export function searchReferenceIds(db, query) {
  const terms = searchTerms(query);
  if (!terms.length) return null;
  const { sql, params } = searchStatement(terms);
  return db.prepare(sql).all(...params).map(row => row.id);
}
