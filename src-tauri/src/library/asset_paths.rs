//! Backups are stored by absolute path. When the library folder was copied or
//! moved outside StashDock (another drive letter, a sync folder, another
//! computer such as a Mac), each missing backup is pointed at the same file
//! under this library's `assets` folder when it is there.
//!
//! Mirrors `plugins/stashdock/server/asset-paths.mjs`; both run on library open
//! and are checked against the same cases.
use super::*;

/// Components after the last `assets` folder, accepting `/` and `\` so a
/// Windows path is understood on macOS and the reverse.
pub(crate) fn tail_after_assets(raw: &str) -> Option<Vec<&str>> {
    let parts: Vec<&str> = raw.split(['/', '\\']).collect();
    let start = parts
        .iter()
        .rposition(|part| part.eq_ignore_ascii_case("assets"))?
        + 1;
    let tail = parts[start..].to_vec();
    let safe = !tail.is_empty()
        && tail
            .iter()
            .all(|part| !part.is_empty() && *part != "." && *part != "..");
    safe.then_some(tail)
}

/// Rewrites stored backup paths that no longer exist but are found under
/// `assets`. Returns how many were repaired; an unchanged library is only read.
pub(crate) fn repair_moved_backups(
    connection: &Connection,
    assets: &Path,
) -> Result<usize, String> {
    let rows: Vec<(String, String)> = connection
        .prepare("SELECT id, asset_path FROM stash_items WHERE asset_path IS NOT NULL AND asset_path != ''")
        .and_then(|mut statement| {
            statement
                .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
                .collect()
        })
        .map_err(|e| e.to_string())?;
    let moved: Vec<(String, String)> = rows
        .into_iter()
        .filter(|(_, raw)| !Path::new(raw).exists())
        .filter_map(|(id, raw)| {
            let candidate = tail_after_assets(&raw)?
                .into_iter()
                .fold(assets.to_path_buf(), |path, part| path.join(part));
            candidate
                .is_file()
                .then(|| (id, candidate.to_string_lossy().into_owned()))
        })
        .collect();
    if moved.is_empty() {
        return Ok(0);
    }
    let transaction =
        rusqlite::Transaction::new_unchecked(connection, rusqlite::TransactionBehavior::Immediate)
            .map_err(|e| e.to_string())?;
    for (id, path) in &moved {
        transaction
            .execute(
                "UPDATE stash_items SET asset_path=?1 WHERE id=?2",
                params![path, id],
            )
            .map_err(|e| e.to_string())?;
    }
    transaction.commit().map_err(|e| e.to_string())?;
    Ok(moved.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_library_copied_elsewhere_finds_its_backups_again() {
        let contract: serde_json::Value =
            serde_json::from_str(include_str!("../../../tests/fixtures/asset-paths.json")).unwrap();
        for case in contract["tails"].as_array().unwrap() {
            let expected = case["tail"].as_array().map(|parts| {
                parts
                    .iter()
                    .map(|p| p.as_str().unwrap())
                    .collect::<Vec<_>>()
            });
            assert_eq!(
                tail_after_assets(case["path"].as_str().unwrap()),
                expected,
                "{}",
                case["path"]
            );
        }
        let root = std::env::temp_dir().join(format!("stashdock-moved-{}", Uuid::new_v4()));
        let assets = root.join("assets");
        fs::create_dir_all(assets.join("item")).unwrap();
        fs::write(assets.join("item").join("Notes.md"), "x").unwrap();
        fs::write(assets.join("flat-Plan.md"), "x").unwrap();
        let connection = Connection::open_in_memory().unwrap();
        initialize_schema(&connection).unwrap();
        let insert = |id: &str, path: &str| {
            connection.execute("INSERT INTO stash_items(id,title,kind,source,excerpt,tags_json,created_at,asset_path,updated_at) VALUES(?1,?1,'file','Local file','','[]','now',?2,'now')", params![id, path]).unwrap();
        };
        insert("windows", r"D:\StashDockData\assets\item\Notes.md");
        insert(
            "plugin",
            "/Users/me/Library/Application Support/app.stashdock.desktop/assets/flat-Plan.md",
        );
        insert("gone", r"D:\StashDockData\assets\other\Missing.md");
        let present = assets
            .join("item")
            .join("Notes.md")
            .to_string_lossy()
            .into_owned();
        insert("present", &present);
        assert_eq!(repair_moved_backups(&connection, &assets).unwrap(), 2);
        let path = |id: &str| {
            connection
                .query_row(
                    "SELECT asset_path FROM stash_items WHERE id=?1",
                    [id],
                    |r| r.get::<_, String>(0),
                )
                .unwrap()
        };
        assert_eq!(path("windows"), present);
        assert_eq!(
            path("plugin"),
            assets.join("flat-Plan.md").to_string_lossy()
        );
        assert_eq!(
            path("gone"),
            r"D:\StashDockData\assets\other\Missing.md",
            "a missing file is left for the usual recovery"
        );
        assert_eq!(
            repair_moved_backups(&connection, &assets).unwrap(),
            0,
            "a repaired library is only read"
        );
        fs::remove_dir_all(root).unwrap();
    }
}
