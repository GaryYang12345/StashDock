// Read-only deployment guard. Do not print any reference content or paths.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

const path = process.argv[2];
if (!path) throw Error('Provide the exact existing StashDock database path.');
const database = new DatabaseSync(path, { readOnly: true });
try {
  const rows = database.prepare('SELECT * FROM stash_items ORDER BY id').all();
  // An additive nullable schema migration must not appear as a content change.
  for (const row of rows) if (row.context_override == null) delete row.context_override;
  if (process.argv.includes('--content-only')) {
    const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
    for (const row of rows) {
      delete row.preview;
      if (row.origin_json) {
        const origin = JSON.parse(row.origin_json);
        delete origin.faviconUrl; delete origin.previewKind;
        row.origin_json = Object.keys(origin).length ? JSON.stringify(canonical(origin)) : null;
      }
    }
  }
  const pinned = database.prepare("SELECT value FROM app_meta WHERE key = 'desktop_pinned_tags_v1'").get()?.value ?? null;
  console.log(JSON.stringify({ count: rows.length, rowsSha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex'), pinnedSha256: createHash('sha256').update(JSON.stringify(pinned)).digest('hex') }));
} finally { database.close(); }
