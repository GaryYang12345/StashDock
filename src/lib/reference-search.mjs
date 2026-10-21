// One search contract for Desktop, the MCP server and the browser workbench.
// A query is whitespace-separated terms; a reference matches when every term
// occurs as a case-insensitive substring of its indexed text. Substring
// matching works for every script (Chinese has no spaces between words).
// Rust mirrors this in src-tauri/src/library/search.rs; both are checked by
// tests/fixtures/search-contract.json.

export const MAX_SEARCH_TERMS = 12;
export const MAX_TERM_CHARACTERS = 100;
// SQLite's trigram index needs three characters; shorter terms use LIKE.
const TRIGRAM = 3;

export function searchTerms(query) {
  const seen = new Set();
  const terms = [];
  for (const raw of String(query ?? '').toLocaleLowerCase('en').split(/\s+/u)) {
    const term = Array.from(raw).slice(0, MAX_TERM_CHARACTERS).join('');
    if (!term || seen.has(term)) continue;
    seen.add(term);
    terms.push(term);
    if (terms.length === MAX_SEARCH_TERMS) break;
  }
  return terms;
}

/** The text a reference is searched by; mirrors search-index.sql. */
export function referenceSearchText(item) {
  const body = item.assetPath || item.hasFile
    ? [item.content, item.contextOverride]
    : [item.contextOverride ?? item.content];
  return [item.title, item.source, item.url, item.excerpt, ...(item.tags || []), ...body]
    .filter(value => typeof value === 'string' && value)
    .join(' ')
    .toLocaleLowerCase('en');
}

export function matchesSearchTerms(text, terms) {
  return terms.every(term => text.includes(term));
}

const ftsPhrase = term => `"${term.replaceAll('"', '""')}"`;
const likePattern = term => `%${term.replace(/[\\%_]/g, character => `\\${character}`)}%`;
const LIKE_COLUMNS = ['title', 'source', 'excerpt', 'tags', 'content'];

/**
 * Ordered SQL for matching reference IDs. Relevance first when the index can
 * rank (any term of three or more characters), then newest first.
 */
export function searchStatement(terms) {
  const long = terms.filter(term => Array.from(term).length >= TRIGRAM);
  const short = terms.filter(term => Array.from(term).length < TRIGRAM);
  const where = [], params = [];
  if (long.length) { where.push('stash_fts MATCH ?'); params.push(long.map(ftsPhrase).join(' AND ')); }
  for (const term of short) {
    where.push(`(${LIKE_COLUMNS.map(column => `stash_fts.${column} LIKE ? ESCAPE '\\'`).join(' OR ')})`);
    params.push(...LIKE_COLUMNS.map(() => likePattern(term)));
  }
  const order = long.length ? 'bm25(stash_fts, 0.0, 8.0, 3.0, 2.0, 2.0, 1.0), s.created_at DESC' : 's.created_at DESC';
  return {
    sql: `SELECT s.id FROM stash_fts JOIN stash_items s ON s.id = stash_fts.id WHERE ${where.join(' AND ') || '1'} ORDER BY ${order}`,
    params,
  };
}
