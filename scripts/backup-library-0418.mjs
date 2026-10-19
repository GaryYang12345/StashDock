import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync } from 'node:fs';
const source='D:/StashDockData/stashdock.sqlite3', target='D:/StashDock/artifacts/library-before-0418-consistent.sqlite3';
if(existsSync(target)) throw Error('Recovery snapshot already exists; do not overwrite it.');
const db=new DatabaseSync(source,{readOnly:true});
try { await backup(db,target); console.log('Created recovery snapshot for 0.4.18 deployment.'); } finally { db.close(); }
