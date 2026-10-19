// Read-only semantic comparison. Expected Note carrier metadata changes are not data loss.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveManagedFile } from '../plugins/stashdock/server/open-file.mjs';
const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) throw Error('Provide the consistent pre-migration backup and current database paths.');
const before = new DatabaseSync(beforePath, { readOnly: true }), after = new DatabaseSync(afterPath, { readOnly: true });
try {
  const previous = before.prepare('SELECT * FROM stash_items ORDER BY id').all();
  const current = after.prepare('SELECT * FROM stash_items ORDER BY id').all();
  assert.equal(current.length, previous.length);
  const byId = new Map(current.map(row => [row.id, row]));
  let notes = 0, otherFiles = 0;
  for (const row of previous) {
    const next = byId.get(row.id); assert.ok(next);
    for (const key of ['id','title','kind','source','url','tags_json','created_at','favorite']) assert.deepEqual(next[key], row[key]);
    if (row.kind === 'note') {
      const file = resolveManagedFile(next.asset_path, join(dirname(afterPath), 'assets'));
      assert.equal(readFileSync(file.path, 'utf8'), row.content ?? row.excerpt ?? '');
      assert.equal(next.context_override, row.context_override); assert.equal(next.mime_type, 'text/plain'); notes++;
    } else {
      for (const key of ['asset_path','original_path','content','context_override','mime_type','size_bytes']) assert.deepEqual(next[key], row[key]);
      if (row.asset_path) otherFiles++;
    }
  }
  assert.deepEqual(after.prepare("SELECT * FROM app_meta WHERE key='pinned_tags_v1'").all(), before.prepare("SELECT * FROM app_meta WHERE key='pinned_tags_v1'").all());
  console.log(JSON.stringify({ references: current.length, migratedNotes: notes, unchangedOtherFiles: otherFiles, identitiesTagsAndSavedTextPreserved: true }));
} finally { before.close(); after.close(); }
