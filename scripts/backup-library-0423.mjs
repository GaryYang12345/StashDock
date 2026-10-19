import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, copyFileSync } from 'node:fs';
const source = 'D:/StashDockData/stashdock.sqlite3', target = 'D:/StashDock/artifacts/library-before-0423.sqlite3';
if (existsSync(target)) throw Error('Recovery snapshot already exists; do not overwrite it.');
const database = new DatabaseSync(source, {readOnly:true});
try { await backup(database,target); } finally { database.close(); }
copyFileSync('D:/StashDock/stashdock.exe', 'D:/StashDock/artifacts/stashdock-before-0423.exe', 1);
console.log('Created consistent 0.4.23 recovery snapshot and executable backup.');
