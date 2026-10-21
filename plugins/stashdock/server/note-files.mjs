// Note creation/migration writes a real managed .txt. Thereafter the file is
// authoritative; SQLite content and search rows are refreshable projections.
import { mkdirSync, writeFileSync, openSync, readSync, closeSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolveManagedFile } from './open-file.mjs';
import { fingerprint } from './original-files.mjs';

const MAX_TEXT_BYTES = 5_000_000;
function projection(path, assets) {
  let descriptor;
  try {
    const file = resolveManagedFile(path, assets);
    if (file.sizeBytes > MAX_TEXT_BYTES) return;
    descriptor = openSync(file.path, 'r');
    // An editor can grow/replace the file after stat. Never read an unbounded
    // allocation or cache a partial new version in that case.
    const buffer = Buffer.alloc(Math.min(MAX_TEXT_BYTES, file.sizeBytes) + 1);
    let length = 0, count;
    while (length < buffer.length && (count = readSync(descriptor, buffer, length, buffer.length - length, null))) length += count;
    if (length !== file.sizeBytes) return;
    return { file, content: new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length)) };
  } catch { return; }
  finally { if (descriptor !== undefined) closeSync(descriptor); }
}
// A note whose file still has the size and modification time recorded at its
// last projection is unchanged; only other notes are read again.
const recorded = row => { try { return JSON.parse(row.origin_json || '{}')?.fileFingerprint; } catch { return undefined; } };
const unchanged = (row, path) => {
  let current; try { current = fingerprint(resolveManagedFile(path, row.assets).path); } catch { return { skip: true }; }
  const previous = recorded(row);
  return { current, skip: Boolean(current && previous && previous.size === current.size && previous.modifiedMs === current.modifiedMs) };
};
export function synchronizeNoteFiles(db, assets, id) {
  const ownsTransaction = !db.isTransaction;
  const created = [];
  // Never select cover blobs here. Unchanged projections don't need a writer
  // reservation; re-read under the transaction when an actual change is found.
  const query = db.prepare(`SELECT id,title,asset_path,content,excerpt,origin_json,size_bytes FROM stash_items WHERE kind='note'${id === undefined ? '' : ' AND id=?'}`);
  const readRows = () => id === undefined ? query.all() : query.all(id);
  const rows = readRows();
  if (ownsTransaction && !rows.some(row => !row.asset_path || !unchanged({ ...row, assets }, row.asset_path).skip)) return;
  if (ownsTransaction) db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of ownsTransaction ? readRows() : rows) {
      let path = row.asset_path, origin;
      try { origin = JSON.parse(row.origin_json || '{}'); } catch { origin = {}; }
      if (!origin || typeof origin !== 'object' || Array.isArray(origin)) origin = {};
      if (!path) {
        const title = Array.from(row.title).slice(0, 48).map(c => /[\p{Cc}<>:"/\\|?*]/u.test(c) ? '-' : c).join('').replace(/^[ .]+|[ .]+$/g, '') || 'Untitled';
        const filename = `Note - ${title}.txt`;
        mkdirSync(assets, { recursive: true });
        path = join(assets, `${randomUUID()}-${filename}`);
        writeFileSync(path, row.content ?? row.excerpt ?? '', { encoding: 'utf8', flag: 'wx' });
        created.push(path); origin = { ...origin, fileName: filename };
      }
      const state = path === row.asset_path ? unchanged({ ...row, assets }, path) : { skip: false };
      if (state.skip) continue;
      // Do not recreate missing managed files from an old database projection.
      const next = projection(path, assets);
      if (!next) continue;
      const { file, content } = next;
      const current = state.current ?? fingerprint(file.path);
      if (current) origin = { ...origin, fileFingerprint: current };
      db.prepare("UPDATE stash_items SET asset_path=?,mime_type='text/plain',size_bytes=?,content=?,excerpt=?,origin_json=? WHERE id=?")
        .run(path, file.sizeBytes, content, Array.from(content.replace(/\s+/g, ' ')).slice(0, 180).join(''), JSON.stringify(origin), row.id);
    }
    if (ownsTransaction) db.exec('COMMIT');
  } catch (error) {
    if (ownsTransaction) { db.exec('ROLLBACK'); for (const path of created) unlinkSync(path); }
    throw error;
  }
}
