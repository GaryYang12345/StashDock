//! A durable, fail-closed redirect lives in the old database. Stale clients
//! cannot keep writing to an obsolete library after a move.
use rusqlite::{Connection, OpenFlags, OptionalExtension};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    time::Duration,
};

pub const REDIRECT_KEY: &str = "library_location_v1";
pub fn display_path(path: &Path) -> String {
    let value = path.to_string_lossy();
    if let Some(unc) = value.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{unc}")
    } else {
        value.strip_prefix(r"\\?\").unwrap_or(&value).to_string()
    }
}
#[derive(serde::Deserialize, serde::Serialize)]
pub struct Registration {
    version: u8,
    pub anchor: PathBuf,
    initialized: bool,
}
pub fn locate(preferred: &Path, registry: &Path) -> Result<Registration, String> {
    use std::io::Write;
    fs::create_dir_all(registry.parent().ok_or("Invalid library registration.")?)
        .map_err(|e| e.to_string())?;
    if !registry.exists() {
        if !preferred.is_absolute() {
            return Err("The library location must be absolute.".into());
        }
        let temporary = registry.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
        let value = Registration {
            version: 1,
            anchor: preferred.to_path_buf(),
            initialized: preferred.join("stashdock.sqlite3").is_file(),
        };
        let result = (|| -> Result<(), String> {
            let mut file = fs::OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(&temporary)
                .map_err(|e| e.to_string())?;
            file.write_all(&serde_json::to_vec(&value).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
            file.sync_all().map_err(|e| e.to_string())?;
            drop(file);
            match fs::hard_link(&temporary, registry) {
                Ok(()) => Ok(()),
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => Ok(()),
                Err(e) => Err(e.to_string()),
            }
        })();
        let _ = fs::remove_file(&temporary);
        result?;
    }
    let bytes = fs::read(registry).map_err(|e| e.to_string())?;
    if bytes.len() > 65536 {
        return Err("Invalid library registration.".into());
    }
    let value: Registration = serde_json::from_slice(&bytes)
        .map_err(|_| "The StashDock library registration is invalid.")?;
    if value.version != 1 || !value.anchor.is_absolute() {
        return Err("The StashDock library registration is invalid.".into());
    }
    if value.initialized && !value.anchor.join("stashdock.sqlite3").is_file() {
        return Err("The StashDock library is unavailable. Reconnect its drive and retry.".into());
    }
    Ok(value)
}
pub fn mark_ready(value: Registration, registry: &Path) -> Result<(), String> {
    use std::io::Write;
    if value.initialized {
        return Ok(());
    }
    let current = locate(&value.anchor, registry)?;
    if current.anchor != value.anchor {
        return Err("The library registration changed. Reopen StashDock.".into());
    }
    let temporary = registry.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| -> Result<(), String> {
        let mut file = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)
            .map_err(|e| e.to_string())?;
        file.write_all(
            &serde_json::to_vec(&Registration {
                initialized: true,
                ..value
            })
            .map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        fs::rename(&temporary, registry).map_err(|e| e.to_string())
    })();
    let _ = fs::remove_file(&temporary);
    result
}
pub fn resolve(root: &Path) -> Result<PathBuf, String> {
    let mut root = root.to_path_buf();
    let mut seen = HashSet::new();
    for _ in 0..32 {
        if !root.is_absolute() {
            return Err("The library location must be an absolute folder.".into());
        }
        if !seen.insert(root.clone()) {
            return Err("The library location contains a loop.".into());
        }
        let database = root.join("stashdock.sqlite3");
        if !database.exists() {
            return Ok(root);
        }
        let db = Connection::open_with_flags(&database, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| e.to_string())?;
        db.busy_timeout(Duration::from_secs(5))
            .map_err(|e| e.to_string())?;
        let has_meta = db
            .query_row(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='app_meta'",
                [],
                |_| Ok(()),
            )
            .optional()
            .map_err(|e| e.to_string())?
            .is_some();
        let next: Option<String> = if has_meta {
            db.query_row(
                "SELECT value FROM app_meta WHERE key=?1",
                [REDIRECT_KEY],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?
        } else {
            None
        };
        match next {
            None => return Ok(root),
            Some(next) => {
                root = PathBuf::from(next);
                if !root.join("stashdock.sqlite3").is_file() {
                    return Err("The moved library is unavailable. Reconnect its drive and restart StashDock.".into());
                }
            }
        }
    }
    Err("Too many library location redirects.".into())
}

fn copy_verified(source: &Path, target: &Path) -> Result<(), String> {
    use sha2::{Digest, Sha256};
    use std::io::{Read, Write};
    let metadata = fs::symlink_metadata(source).map_err(|e| e.to_string())?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("The library contains an unsupported linked file.".into());
    }
    let mut input = fs::File::open(source).map_err(|e| e.to_string())?;
    let mut output = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(target)
        .map_err(|e| e.to_string())?;
    let mut hash = Sha256::new();
    let mut bytes = [0u8; 65536];
    loop {
        let n = input.read(&mut bytes).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hash.update(&bytes[..n]);
        output.write_all(&bytes[..n]).map_err(|e| e.to_string())?;
    }
    output.sync_all().map_err(|e| e.to_string())?;
    let expected = hash.finalize();
    let mut check = fs::File::open(target).map_err(|e| e.to_string())?;
    let mut hash = Sha256::new();
    loop {
        let n = check.read(&mut bytes).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hash.update(&bytes[..n]);
    }
    if hash.finalize() != expected {
        return Err(
            "A file could not be verified. Your original library has not been moved.".into(),
        );
    }
    Ok(())
}

/// New destination must be empty. Original data stays intact; only its writes
/// are retired atomically after the verified snapshot is complete.
pub fn relocate(source: &Path, target: &Path) -> Result<PathBuf, String> {
    let source = fs::canonicalize(source).map_err(|e| e.to_string())?;
    let target =
        fs::canonicalize(target).map_err(|_| "Choose an existing, empty folder.".to_string())?;
    if source.starts_with(&target) || target.starts_with(&source) {
        return Err("Choose a different folder outside the current library.".into());
    }
    if fs::read_dir(&target)
        .map_err(|e| e.to_string())?
        .next()
        .is_some()
    {
        return Err("Choose an empty folder so existing files are not overwritten.".into());
    }
    let mut source_db =
        Connection::open(source.join("stashdock.sqlite3")).map_err(|e| e.to_string())?;
    source_db
        .busy_timeout(Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    let transaction = source_db
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|_| "The library is busy. Finish importing and try again.".to_string())?;
    if transaction
        .query_row(
            "SELECT value FROM app_meta WHERE key=?1",
            [REDIRECT_KEY],
            |r| r.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err("The library location has already changed. Restart StashDock.".into());
    }
    // An online SQLite snapshot includes WAL data. The independent write lock
    // prevents changes to the source while assets and the snapshot are copied.
    let snapshot_source = Connection::open_with_flags(
        source.join("stashdock.sqlite3"),
        OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .map_err(|e| e.to_string())?;
    snapshot_source
        .backup("main", target.join("stashdock.sqlite3"), None)
        .map_err(|e| e.to_string())?;
    let assets = target.join("assets");
    fs::create_dir(&assets).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(source.join("assets")).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        copy_verified(&entry.path(), &assets.join(entry.file_name()))?;
    }
    let mut destination =
        Connection::open(target.join("stashdock.sqlite3")).map_err(|e| e.to_string())?;
    let update = destination.transaction().map_err(|e| e.to_string())?;
    let rows: Vec<(String, String)> = {
        let mut stmt = update.prepare("SELECT id,asset_path FROM stash_items WHERE asset_path IS NOT NULL AND asset_path!=''").map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<_, _>>().map_err(|e| e.to_string())?
    };
    for (id, path) in rows {
        let original = fs::canonicalize(path).map_err(|_| {
            "An original file is missing. Restore it before changing the storage folder."
                .to_string()
        })?;
        let relative = original
            .strip_prefix(source.join("assets"))
            .map_err(|_| "An original file is outside the managed library.".to_string())?;
        if relative.components().count() != 1 || !assets.join(relative).is_file() {
            return Err("An original file could not be moved safely.".into());
        }
        update
            .execute(
                "UPDATE stash_items SET asset_path=?1 WHERE id=?2",
                rusqlite::params![assets.join(relative).to_string_lossy(), id],
            )
            .map_err(|e| e.to_string())?;
    }
    // Do not inherit another process's live preview lease.
    update
        .execute(
            "DELETE FROM app_meta WHERE key='web_preview_worker_until'",
            [],
        )
        .map_err(|e| e.to_string())?;
    update.commit().map_err(|e| e.to_string())?;
    let check: String = destination
        .query_row("PRAGMA quick_check", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if check != "ok" {
        return Err(
            "The copied library could not be verified. Your original library is unchanged.".into(),
        );
    }
    destination
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE)")
        .map_err(|e| e.to_string())?;
    // Old clients either follow this pointer or fail visibly, never fork data.
    transaction
        .execute(
            "INSERT INTO app_meta(key,value) VALUES (?1,?2)",
            rusqlite::params![REDIRECT_KEY, target.to_string_lossy()],
        )
        .map_err(|e| e.to_string())?;
    for table in ["stash_items", "app_meta"] {
        for action in ["INSERT", "UPDATE", "DELETE"] {
            transaction.execute_batch(&format!("CREATE TRIGGER moved_{table}_{action} BEFORE {action} ON {table} BEGIN SELECT RAISE(ABORT, 'Library moved. Restart StashDock or reopen its Codex connection.'); END;")).map_err(|e| e.to_string())?;
        }
    }
    transaction.commit().map_err(|e| e.to_string())?;
    Ok(target)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn display_paths_preserve_local_and_unc_windows_locations() {
        assert_eq!(display_path(Path::new(r"\\?\C:\Library")), r"C:\Library");
        assert_eq!(
            display_path(Path::new(r"\\?\UNC\server\share\Library")),
            r"\\server\share\Library"
        );
    }
    #[test]
    fn all_installations_share_one_registered_anchor_and_missing_data_fails_closed() {
        let root =
            std::env::temp_dir().join(format!("stashdock-anchor-native-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let registry = root.join("library-root-v1.json");
        let preferred = root.join("first");
        let registration = locate(&preferred, &registry).unwrap();
        assert_eq!(
            locate(&root.join("other"), &registry).unwrap().anchor,
            preferred
        );
        fs::create_dir(&preferred).unwrap();
        let database = preferred.join("stashdock.sqlite3");
        fs::write(&database, b"fixture").unwrap();
        mark_ready(registration, &registry).unwrap();
        assert_eq!(
            locate(&root.join("other"), &registry).unwrap().anchor,
            preferred
        );
        fs::remove_file(&database).unwrap();
        assert!(locate(&root.join("other"), &registry).is_err());
        assert!(root.starts_with(std::env::temp_dir()));
        fs::remove_dir_all(root).unwrap();
    }
    fn fixture() -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("stashdock-location-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("old/assets")).unwrap();
        fs::create_dir(root.join("new")).unwrap();
        let db = Connection::open(root.join("old/stashdock.sqlite3")).unwrap();
        db.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE stash_items(id TEXT PRIMARY KEY,asset_path TEXT,content TEXT);").unwrap();
        fs::write(root.join("old/assets/file.pdf"), b"unchanged original").unwrap();
        db.execute(
            "INSERT INTO stash_items VALUES ('one',?1,'user content')",
            [root.join("old/assets/file.pdf").to_str().unwrap()],
        )
        .unwrap();
        root
    }
    #[test]
    fn move_verifies_originals_rebases_paths_and_retires_stale_writes() {
        let root = fixture();
        let stale = Connection::open(root.join("old/stashdock.sqlite3")).unwrap();
        let dest = relocate(&root.join("old"), &root.join("new")).unwrap();
        assert_eq!(resolve(&root.join("old")).unwrap(), dest);
        assert_eq!(
            fs::read(dest.join("assets/file.pdf")).unwrap(),
            b"unchanged original"
        );
        assert!(stale
            .execute("UPDATE stash_items SET content='lost'", [])
            .is_err());
        let db = Connection::open(dest.join("stashdock.sqlite3")).unwrap();
        assert_eq!(
            db.query_row("SELECT content FROM stash_items", [], |r| r
                .get::<_, String>(0))
                .unwrap(),
            "user content"
        );
        assert_eq!(
            PathBuf::from(
                db.query_row("SELECT asset_path FROM stash_items", [], |r| r
                    .get::<_, String>(0))
                    .unwrap()
            ),
            dest.join("assets/file.pdf")
        );
        db.execute("UPDATE stash_items SET content='new content'", [])
            .unwrap();
        drop(db);
        drop(stale);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn refuses_nonempty_nested_destinations_and_missing_originals() {
        let root = fixture();
        assert!(relocate(&root.join("old"), &root.join("old/assets")).is_err());
        fs::write(root.join("new/user.txt"), b"keep").unwrap();
        assert!(relocate(&root.join("old"), &root.join("new")).is_err());
        assert_eq!(fs::read(root.join("new/user.txt")).unwrap(), b"keep");
        assert_eq!(resolve(&root.join("old")).unwrap(), root.join("old"));
        fs::remove_dir_all(root).unwrap();
    }
}
