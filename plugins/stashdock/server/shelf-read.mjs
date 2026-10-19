// One read snapshot, compact search rows, only the visible page's cover blobs.
// Background refresh must not deserialize every original and image in a library.
import { search } from './library.mjs';

export function createShelfReader(db, { fromRow, synchronize, annotate }) {
  const fields = `id,title,kind,source,url,excerpt,tags_json,created_at,favorite,origin_json,mime_type,
    CASE WHEN asset_path IS NOT NULL AND asset_path!='' THEN 1 ELSE 0 END AS has_file`;
  const readIndex = (withContent = false) => {
    if (withContent) synchronize();
    return db.prepare(`SELECT ${fields},${withContent ? 'content,context_override' : 'NULL AS content,NULL AS context_override'} FROM stash_items ORDER BY created_at DESC`).all().map(fromRow);
  };
  return {
    readIndex,
    readShelf: (args = {}) => {
      // File projections may write. Finish them before the read snapshot.
      const withContent = Boolean(args.query?.trim());
      if (withContent) synchronize();
      db.exec('BEGIN');
      try {
        const rows = db.prepare(`SELECT ${fields},${withContent ? 'content,context_override' : 'NULL AS content,NULL AS context_override'} FROM stash_items ORDER BY created_at DESC`).all().map(fromRow);
        const result = search(rows, { ...args, limit: args.limit ?? 30 });
        const image = db.prepare('SELECT preview FROM stash_items WHERE id=?');
        result.items = annotate(result.items.map(row => ({ ...row, preview: image.get(row.id)?.preview || undefined })));
        const counts = new Map();
        for (const row of rows) for (const tag of row.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
        db.exec('COMMIT');
        return { ...result, tags: [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count })) };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}
