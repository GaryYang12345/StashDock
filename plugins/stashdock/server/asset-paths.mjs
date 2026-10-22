// Backups are stored by absolute path. When the library folder was copied or
// moved outside StashDock (another drive letter, a sync folder, another
// computer such as a Mac), each missing backup is pointed at the same file
// under this library's assets folder when it is there.
// Mirrors src-tauri/src/library/asset_paths.rs; tests/fixtures/asset-paths.json.
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Components after the last `assets` folder, accepting `/` and `\`. */
export function tailAfterAssets(raw) {
  const parts = String(raw).split(/[\\/]/);
  let index = -1;
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].toLowerCase() === 'assets') { index = i; break; }
  if (index < 0) return null;
  const tail = parts.slice(index + 1);
  return tail.length && tail.every(part => part && part !== '.' && part !== '..') ? tail : null;
}

const isFile = path => { try { return statSync(path).isFile(); } catch { return false; } };

/** Rewrites missing backup paths found under `assets`; an unchanged library is only read. */
export function repairMovedBackups(db, assets) {
  const moved = db.prepare("SELECT id,asset_path FROM stash_items WHERE asset_path IS NOT NULL AND asset_path!=''").all()
    .filter(row => !existsSync(row.asset_path))
    .map(row => { const tail = tailAfterAssets(row.asset_path); const candidate = tail && join(assets, ...tail); return candidate && isFile(candidate) ? { id: row.id, path: candidate } : null; })
    .filter(Boolean);
  if (!moved.length) return 0;
  db.exec('BEGIN IMMEDIATE');
  try { const update = db.prepare('UPDATE stash_items SET asset_path=? WHERE id=?'); for (const row of moved) update.run(row.path, row.id); db.exec('COMMIT'); }
  catch (error) { db.exec('ROLLBACK'); throw error; }
  return moved.length;
}
