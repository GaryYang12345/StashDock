//! Shared reference search. Mirrors `src/lib/reference-search.mjs` and runs the
//! same `search-index.sql` as the MCP server; both are checked against
//! `tests/fixtures/search-contract.json`.
//!
//! A query is whitespace-separated terms. A reference matches when every term
//! occurs as a case-insensitive substring of its indexed text, which works for
//! scripts without spaces between words (Chinese, Japanese).
use rusqlite::{params_from_iter, Connection, OptionalExtension};

const INDEX_SQL: &str = include_str!("../../../plugins/stashdock/server/search-index.sql");
const INDEX_KEY: &str = "fts_trigram_v1";
const MAX_TERMS: usize = 12;
const MAX_TERM_CHARACTERS: usize = 100;
// SQLite's trigram index needs three characters; shorter terms use LIKE.
const TRIGRAM: usize = 3;
const LIKE_COLUMNS: [&str; 5] = ["title", "source", "excerpt", "tags", "content"];

fn index_sql() -> (&'static str, &'static str) {
    INDEX_SQL
        .split_once("-- rebuild")
        .expect("search-index.sql has a rebuild section")
}

/// Create the trigram index and its triggers; rebuild once when upgrading.
/// Call inside a write transaction.
pub(super) fn prepare_index(connection: &Connection) -> rusqlite::Result<()> {
    let ready = connection
        .query_row("SELECT 1 FROM app_meta WHERE key = ?1", [INDEX_KEY], |_| Ok(()))
        .optional()?
        .is_some();
    let (definition, rebuild) = index_sql();
    if !ready {
        connection.execute_batch("DROP TABLE IF EXISTS stash_fts")?;
    }
    connection.execute_batch(definition)?;
    if !ready {
        connection.execute_batch(rebuild)?;
        connection.execute(
            "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?1, '1')",
            [INDEX_KEY],
        )?;
    }
    Ok(())
}

/// Re-derive every index row from `stash_items`.
pub(super) fn rebuild_index(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(index_sql().1)
}

pub(super) fn search_terms(query: &str) -> Vec<String> {
    let mut terms: Vec<String> = Vec::new();
    for raw in query.to_lowercase().split_whitespace() {
        let term: String = raw.chars().take(MAX_TERM_CHARACTERS).collect();
        if term.is_empty() || terms.contains(&term) {
            continue;
        }
        terms.push(term);
        if terms.len() == MAX_TERMS {
            break;
        }
    }
    terms
}

fn like_pattern(term: &str) -> String {
    let mut pattern = String::from("%");
    for character in term.chars() {
        if matches!(character, '\\' | '%' | '_') {
            pattern.push('\\');
        }
        pattern.push(character);
    }
    pattern.push('%');
    pattern
}

/// Ordered SQL for matching IDs: relevance first when any term can use the
/// index, then newest first.
pub(super) fn statement(terms: &[String]) -> (String, Vec<String>) {
    let (long, short): (Vec<&String>, Vec<&String>) = terms
        .iter()
        .partition(|term| term.chars().count() >= TRIGRAM);
    let mut conditions = Vec::new();
    let mut values = Vec::new();
    if !long.is_empty() {
        conditions.push("stash_fts MATCH ?".to_string());
        values.push(
            long.iter()
                .map(|term| format!("\"{}\"", term.replace('"', "\"\"")))
                .collect::<Vec<_>>()
                .join(" AND "),
        );
    }
    for term in short {
        conditions.push(format!(
            "({})",
            LIKE_COLUMNS
                .iter()
                .map(|column| format!("stash_fts.{column} LIKE ? ESCAPE '\\'"))
                .collect::<Vec<_>>()
                .join(" OR ")
        ));
        let pattern = like_pattern(term);
        values.extend(LIKE_COLUMNS.iter().map(|_| pattern.clone()));
    }
    let order = if long.is_empty() {
        "s.created_at DESC"
    } else {
        "bm25(stash_fts, 0.0, 8.0, 3.0, 2.0, 2.0, 1.0), s.created_at DESC"
    };
    let filter = if conditions.is_empty() {
        "1".to_string()
    } else {
        conditions.join(" AND ")
    };
    (
        format!("SELECT s.id FROM stash_fts JOIN stash_items s ON s.id = stash_fts.id WHERE {filter} ORDER BY {order}"),
        values,
    )
}

/// Ordered matching reference IDs, or `None` when the query has no terms.
pub(super) fn search_ids(connection: &Connection, query: &str) -> Result<Option<Vec<String>>, String> {
    let terms = search_terms(query);
    if terms.is_empty() {
        return Ok(None);
    }
    let (sql, values) = statement(&terms);
    let mut prepared = connection.prepare(&sql).map_err(|e| e.to_string())?;
    let ids = prepared
        .query_map(params_from_iter(values.iter()), |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(Some(ids))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn contract_library() -> (Connection, serde_json::Value) {
        let contract: serde_json::Value =
            serde_json::from_str(include_str!("../../../tests/fixtures/search-contract.json")).unwrap();
        let connection = Connection::open_in_memory().unwrap();
        super::super::initialize_schema(&connection).unwrap();
        for (index, item) in contract["items"].as_array().unwrap().iter().enumerate() {
            let text = |key: &str| item[key].as_str().map(str::to_string);
            connection
                .execute(
                    "INSERT INTO stash_items(id,title,kind,source,url,excerpt,tags_json,created_at,asset_path,content,context_override,updated_at)
                     VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'now')",
                    rusqlite::params![
                        text("id"), text("title"), text("kind"), text("source"), text("url"), text("excerpt"),
                        item["tags"].to_string(), format!("2026-01-{:02}T00:00:00Z", index + 1),
                        text("assetPath"), text("content"), text("contextOverride"),
                    ],
                )
                .unwrap();
        }
        (connection, contract)
    }

    #[test]
    fn desktop_index_satisfies_the_shared_search_contract() {
        let (connection, contract) = contract_library();
        for case in contract["cases"].as_array().unwrap() {
            let query = case["query"].as_str().unwrap();
            let mut expected: Vec<String> = case["ids"]
                .as_array()
                .unwrap()
                .iter()
                .map(|id| id.as_str().unwrap().to_string())
                .collect();
            let mut actual = search_ids(&connection, query).unwrap().unwrap();
            expected.sort();
            actual.sort();
            assert_eq!(actual, expected, "query {query:?}");
        }
        assert_eq!(search_ids(&connection, "  \t ").unwrap(), None);
    }

    #[test]
    fn triggers_follow_updates_and_deletes() {
        let (connection, _) = contract_library();
        connection
            .execute("UPDATE stash_items SET title='机器学习手册' WHERE id='zh-title'", [])
            .unwrap();
        assert_eq!(search_ids(&connection, "机器").unwrap().unwrap(), vec!["zh-title"]);
        connection.execute("DELETE FROM stash_items WHERE id='zh-title'", []).unwrap();
        assert!(search_ids(&connection, "机器").unwrap().unwrap().is_empty());
    }

    #[test]
    fn unicode61_library_upgrades_once_to_trigram() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(include_str!("../../../plugins/stashdock/server/schema.sql"))
            .unwrap();
        connection
            .execute_batch(
                "CREATE VIRTUAL TABLE stash_fts USING fts5(id UNINDEXED,title,source,excerpt,tags,content,tokenize='unicode61',prefix='2 3');
                 INSERT INTO stash_items(id,title,kind,source,excerpt,tags_json,created_at,updated_at) VALUES('old','深度学习入门教程','web','Example','','[]','2026-01-01T00:00:00Z','now');
                 INSERT INTO stash_fts SELECT id,title,source,excerpt,tags_json,'' FROM stash_items;
                 INSERT INTO app_meta(key,value) VALUES('fts_initialized_v1','1');",
            )
            .unwrap();
        super::super::initialize_schema(&connection).unwrap();
        assert_eq!(search_ids(&connection, "学习").unwrap().unwrap(), vec!["old"]);
        let count: i64 = connection
            .query_row("SELECT count(*) FROM stash_fts", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
        super::super::initialize_schema(&connection).unwrap();
        let count: i64 = connection
            .query_row("SELECT count(*) FROM stash_fts", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }
}
