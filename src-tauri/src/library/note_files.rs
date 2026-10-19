//! Note creation produces a normal .txt asset. Text/search fields are projections;
//! supplemental context remains independent, exactly as for other managed files.
use super::*;
use std::io::Write;

fn read_projection(path: &Path) -> Option<(u64, String)> {
    let size = path.metadata().ok()?.len();
    if size > 5_000_000 {
        return None;
    }
    let mut content = String::new();
    fs::File::open(path)
        .ok()?
        .take(5_000_001)
        .read_to_string(&mut content)
        .ok()?;
    if content.len() as u64 != size {
        return None;
    }
    Some((
        size,
        content
            .strip_prefix('\u{feff}')
            .unwrap_or(&content)
            .to_string(),
    ))
}

fn needs_refresh(connection: &Connection, assets: &Path) -> Result<bool, String> {
    let mut query = connection
        .prepare("SELECT asset_path,content,size_bytes FROM stash_items WHERE kind='note'")
        .map_err(|e| e.to_string())?;
    let rows = query
        .query_map([], |r| {
            Ok((
                r.get::<_, Option<String>>(0)?,
                r.get::<_, Option<String>>(1)?,
                r.get::<_, Option<i64>>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    for row in rows {
        let (asset, cached, size) = row.map_err(|e| e.to_string())?;
        let Some(asset) = asset.filter(|path| !path.is_empty()) else {
            return Ok(true);
        };
        let Some((bytes, content)) = file_payload::managed_asset_path(assets, &asset)
            .ok()
            .and_then(|path| read_projection(&path))
        else {
            continue;
        };
        if cached.as_deref() != Some(content.as_str()) || size != Some(bytes as i64) {
            return Ok(true);
        }
    }
    Ok(false)
}

pub(super) fn synchronize(connection: &Connection) -> Result<(), String> {
    let Some(database) = connection
        .path()
        .filter(|path| !path.is_empty() && *path != ":memory:")
    else {
        return Ok(());
    };
    let assets = Path::new(database)
        .parent()
        .ok_or("The file library is unavailable.")?
        .join("assets");
    // A read/refresh must not take a writer lock just to confirm unchanged text.
    // Changes are re-read after acquiring the transaction, not written from an
    // optimistic snapshot that could erase a concurrent metadata edit.
    if connection.is_autocommit() && !needs_refresh(connection, &assets)? {
        return Ok(());
    }
    let tx = if connection.is_autocommit() {
        Some(
            rusqlite::Transaction::new_unchecked(
                connection,
                rusqlite::TransactionBehavior::Immediate,
            )
            .map_err(|e| e.to_string())?,
        )
    } else {
        None
    };
    let notes = {
        let mut query = connection.prepare("SELECT id,title,asset_path,content,excerpt,origin_json,size_bytes FROM stash_items WHERE kind='note'").map_err(|e| e.to_string())?;
        let rows = query
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, Option<i64>>(6)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };
    for (id, title, asset, cached, excerpt, raw_origin, cached_size) in notes {
        let mut origin: serde_json::Value = raw_origin
            .as_deref()
            .and_then(|value| serde_json::from_str(value).ok())
            .filter(serde_json::Value::is_object)
            .unwrap_or_else(|| serde_json::json!({}));
        let path = if let Some(raw) = asset.as_deref().filter(|raw| !raw.is_empty()) {
            match file_payload::managed_asset_path(&assets, raw) {
                Ok(path) => path,
                Err(_) => continue,
            }
        } else {
            let title: String = title
                .chars()
                .take(48)
                .map(|c| {
                    if c.is_control() || "<>:\"/\\|?*".contains(c) {
                        '-'
                    } else {
                        c
                    }
                })
                .collect();
            let title = title.trim_matches([' ', '.']);
            let filename = format!(
                "Note - {}.txt",
                if title.is_empty() { "Untitled" } else { title }
            );
            fs::create_dir_all(&assets).map_err(|e| e.to_string())?;
            let path = assets.join(format!("{}-{filename}", Uuid::new_v4()));
            fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)
                .and_then(|mut file| {
                    file.write_all(cached.as_deref().unwrap_or(&excerpt).as_bytes())
                })
                .map_err(|e| e.to_string())?;
            origin["fileName"] = serde_json::json!(filename);
            path
        };
        let Some((size, content)) = read_projection(&path) else {
            continue;
        };
        if asset.is_some()
            && cached.as_deref() == Some(&content)
            && cached_size == Some(size as i64)
        {
            continue;
        }
        connection.execute("UPDATE stash_items SET asset_path=?1,mime_type='text/plain',size_bytes=?2,content=?3,excerpt=?4,origin_json=?5 WHERE id=?6",
            params![crate::library_location::display_path(&path), size as i64, content, text_excerpt(&content), origin.to_string(), id]).map_err(|e| e.to_string())?;
        connection
            .execute("DELETE FROM stash_fts WHERE id=?1", [&id])
            .map_err(|e| e.to_string())?;
        connection.execute("INSERT INTO stash_fts SELECT id,title,source,excerpt,tags_json,COALESCE(content,'') || ' ' || COALESCE(context_override,'') FROM stash_items WHERE id=?1", [&id]).map_err(|e| e.to_string())?;
    }
    if let Some(tx) = tx {
        tx.commit().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn migration_and_external_edits_use_one_original_with_separate_context() {
        let root =
            std::env::temp_dir().join(format!("stashdock-canonical-note-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let db = Connection::open(root.join("stashdock.sqlite3")).unwrap();
        initialize_schema(&db).unwrap();
        db.execute("INSERT INTO stash_items(id,title,kind,source,excerpt,tags_json,created_at,updated_at,content,context_override) VALUES('note','Rules','note','Note','','[]','2026-10-17','2026-10-17','Original body','Additional context')", []).unwrap();
        synchronize(&db).unwrap();
        let path: String = db
            .query_row(
                "SELECT asset_path FROM stash_items WHERE id='note'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(Path::new(&path).extension().unwrap(), "txt");
        assert_eq!(fs::read_to_string(&path).unwrap(), "Original body");
        fs::write(&path, "External editor\n最新原文").unwrap();
        synchronize(&db).unwrap();
        let body: String = db
            .query_row(
                "SELECT content FROM stash_items WHERE id='note'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(body, "External editor\n最新原文");
        super::super::edit_content(&db, "note", "Updated supplemental context").unwrap();
        assert_eq!(
            fs::read_to_string(&path).unwrap(),
            "External editor\n最新原文"
        );
        let transfer = crate::reference_transfer::export(
            &root.join("stashdock.sqlite3"),
            &["note".into()],
            &root.join("outgoing"),
        )
        .unwrap();
        assert_eq!(transfer.files.len(), 2);
        assert!(transfer.files.iter().any(|file| file
            .extension()
            .is_some_and(|extension| extension == "txt")
            && fs::read_to_string(file).unwrap() == body));
        let node = std::process::Command::new("node").current_dir(Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap())
            .args(["--input-type=module", "-e", "import{createLocalLibrary}from'./plugins/stashdock/server/local-library.mjs';import{writeFileSync}from'node:fs';const l=createLocalLibrary({dataDir:process.argv[1]});writeFileSync(l.resolveFile('note').path,'Updated through the AI provider original');l.close();"])
            .arg(&root).output().unwrap();
        assert!(
            node.status.success(),
            "{}",
            String::from_utf8_lossy(&node.stderr)
        );
        synchronize(&db).unwrap();
        let current: (String, String, String) = db
            .query_row(
                "SELECT content,context_override,asset_path FROM stash_items WHERE id='note'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(current.0, "Updated through the AI provider original");
        assert_eq!(current.1, "Updated supplemental context");
        assert_eq!(current.2, path);
        assert_eq!(fs::read_dir(root.join("assets")).unwrap().count(), 1);
        fs::remove_file(&path).unwrap();
        synchronize(&db).unwrap();
        assert!(!Path::new(&path).exists());
        drop(db);
        fs::remove_dir_all(root).unwrap();
    }
}
