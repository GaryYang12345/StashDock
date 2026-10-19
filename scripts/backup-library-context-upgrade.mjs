import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync } from 'node:fs';
const source = 'D:/StashDockData/stashdock.sqlite3';
const target = 'D:/StashDock/artifacts/library-before-context-044-20261010.sqlite3';
if (existsSync(target)) throw Error('Recovery snapshot already exists; do not overwrite it.');
const db = new DatabaseSync(source, { readOnly: true });
try { await backup(db, target); console.log('Created recoverable SQLite snapshot before schema upgrade.'); }
finally { db.close(); }
