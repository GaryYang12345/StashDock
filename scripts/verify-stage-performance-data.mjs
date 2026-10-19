// Read-only semantic row check. Lease/status metadata is intentionally excluded.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
const digest = path => {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const rows = db.prepare('SELECT * FROM stash_items ORDER BY id').all();
    const keys = Object.keys(rows[0] || {}).sort();
    return { count: rows.length, sha256: createHash('sha256').update(JSON.stringify(rows.map(row => keys.map(key => row[key])))).digest('hex') };
  } finally { db.close(); }
};
const before = digest('D:/StashDock/artifacts/stage-performance-20261017-before/stashdock.sqlite3');
const current = digest('D:/StashDockData/stashdock.sqlite3');
console.log(JSON.stringify({ before, current, unchanged: before.sha256 === current.sha256 }));
if (before.sha256 !== current.sha256) process.exitCode = 1;
