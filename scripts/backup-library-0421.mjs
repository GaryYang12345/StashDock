import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync } from 'node:fs';
const source = 'D:/StashDockData/stashdock.sqlite3', target = 'D:/StashDock/artifacts/library-before-0421-audit.sqlite3';
if (existsSync(target)) throw Error('Recovery snapshot already exists; do not overwrite it.');
const database = new DatabaseSync(source, {readOnly: true});
try { await backup(database, target); console.log('Created consistent 0.4.21 recovery snapshot.'); } finally { database.close(); }
