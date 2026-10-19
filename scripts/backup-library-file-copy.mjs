import { DatabaseSync, backup } from 'node:sqlite';
import { copyFileSync, existsSync } from 'node:fs';
const target = 'D:/StashDock/artifacts/library-before-file-copy.sqlite3';
if (existsSync(target)) throw Error('Recovery snapshot exists; do not overwrite it.');
const database = new DatabaseSync('D:/StashDockData/stashdock.sqlite3', {readOnly:true});
try { await backup(database, target); } finally { database.close(); }
copyFileSync('D:/StashDock/stashdock.exe', 'D:/StashDock/artifacts/stashdock-before-file-copy.exe', 1);
console.log('Consistent library and desktop executable recovery snapshots created.');
