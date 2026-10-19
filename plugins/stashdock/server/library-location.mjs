import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

export const LOCATION_KEY = 'library_location_v1';
// Windows canonicalization adds a verbatim prefix; it is not another folder.
export function displayLibraryDirectory(path) {
  return path.startsWith('\\\\?\\UNC\\') ? '\\\\' + path.slice(8) : path.startsWith('\\\\?\\') ? path.slice(4) : path;
}
export function libraryPathIdentity(path) {
  const value = resolve(displayLibraryDirectory(path));
  return process.platform === 'win32' ? value.toLowerCase() : value;
}
// Mirrors the native resolver. A missing destination is an error, never an
// invitation to create an empty second library.
export function resolveLibraryDirectory(directory) {
  let current = resolve(directory);
  const seen = new Set();
  for (let depth = 0; depth < 32; depth++) {
    if (seen.has(current)) throw Error('The library location contains a loop.');
    seen.add(current);
    const path = join(current, 'stashdock.sqlite3');
    if (!existsSync(path)) return current;
    const db = new DatabaseSync(path, { readOnly: true });
    let next;
    try { if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='app_meta' AND type='table'").get()) next = db.prepare('SELECT value FROM app_meta WHERE key=?').get(LOCATION_KEY)?.value; }
    finally { db.close(); }
    if (next === undefined) return current;
    if (typeof next !== 'string' || !isAbsolute(next)) throw Error('The moved library location is invalid.');
    current = resolve(next);
    if (!existsSync(join(current, 'stashdock.sqlite3'))) throw Error('The moved library is unavailable. Reconnect its drive and reopen StashDock.');
  }
  throw Error('Too many library location redirects.');
}
