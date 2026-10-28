// Single-page capture protocol. Never return the library, bodies or thumbnails.
import { createHash } from 'node:crypto';
import { canonicalReferenceUrl } from '../../../src/lib/reference-url.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const receiptPrefix = 'browser_capture_receipt_v1:';
export function browserCaptureStore(db, { insert }) {
  function find(url) {
    url = canonicalReferenceUrl(url);
    const direct = db.prepare('SELECT id FROM stash_items WHERE url=? LIMIT 1').get(url);
    // Preserve identity of legacy non-canonical URLs without migrating user data.
    return direct || db.prepare('SELECT id,url FROM stash_items WHERE url IS NOT NULL').all().find(row => {
      try { return canonicalReferenceUrl(row.url) === url; } catch { return false; }
    });
  }
  function summary(id) {
    const row = db.prepare('SELECT id,title,updated_at,tags_json,content,preview,origin_json,context_override,favorite FROM stash_items WHERE id=?').get(id);
    if (!row) return null;
    return { id: row.id, title: row.title, revision: hash(JSON.stringify([row.id,row.updated_at,row.title,row.tags_json,row.content,row.preview,row.origin_json,row.context_override,row.favorite])) };
  }
  const lookupCapture = (url, operationId, digest) => {
    canonicalReferenceUrl(url);
    if (/^[a-z0-9-]{16,64}$/i.test(operationId || '') && /^[a-f0-9]{64}$/.test(digest || '')) {
      const stored = db.prepare('SELECT value FROM app_meta WHERE key=?').get(receiptPrefix + operationId);
      if (stored) { const receipt=JSON.parse(stored.value); if(receipt.digest===digest)return receipt.result; }
    }
    return { duplicate: summary(find(url)?.id || '') };
  };
  const captureTags = () => [...new Set(db.prepare('SELECT tags_json FROM stash_items').all().flatMap(row => JSON.parse(row.tags_json)))].sort((a,b) => a.localeCompare(b));
  function saveCapture(body) {
    const input = JSON.parse(body), raw = input?.item;
    if (!input || Object.keys(input).some(key => !['item','operationId','replace'].includes(key)) || typeof input.operationId !== 'string' || !/^[a-z0-9-]{16,64}$/i.test(input.operationId)
      || !raw || !['web','repo'].includes(raw.kind) || typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 500
      || typeof raw.content !== 'string' || raw.content.length > 20000 || !Array.isArray(raw.tags) || raw.tags.length > 12
      || raw.tags.some(tag => typeof tag !== 'string' || tag.length > 48) || raw.assetPath != null || raw.originalPath != null || raw.contextOverride != null
      || raw.preview != null && (typeof raw.preview !== 'string' || raw.preview.length > 750000 || !/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(raw.preview))) throw Error('Invalid page capture.');
    const url = canonicalReferenceUrl(raw.url), key = receiptPrefix + input.operationId, digest = hash(body);
    db.exec('BEGIN IMMEDIATE');
    try {
      const stored = db.prepare('SELECT value FROM app_meta WHERE key=?').get(key);
      if (stored) {
        const receipt = JSON.parse(stored.value);
        if (receipt.digest !== digest) throw Error('This save request changed. Save the page again.');
        db.exec('COMMIT'); return receipt.result;
      }
      const existing = summary(find(url)?.id || '');
      if (existing && (input.replace?.id !== existing.id || input.replace?.revision !== existing.revision)) {
        db.exec('COMMIT'); return { duplicate: existing };
      }
      if (!existing && input.replace) throw Error('The reference changed. Save the page again.');
      const origin = {};
      for (const name of ['platform','externalId','faviconUrl','author','publishedAt','captureMethod','truncated','previewKind']) {
        const value = raw.origin?.[name];
        if (typeof value === 'string' && value.length <= 32768 || typeof value === 'boolean') origin[name] = value;
      }
      origin.importMethod = 'browser_extension'; origin.importedAt = new Date().toISOString();
      const item = { ...raw, url, title: raw.title.trim(), origin, content: raw.content.trim() };
      let id;
      if (existing) {
        id = existing.id;
        // An explicit replacement uses this capture, including its final context.
        db.prepare('UPDATE stash_items SET title=?,kind=?,source=?,url=?,excerpt=?,tags_json=?,content=?,preview=?,origin_json=?,context_override=NULL,favorite=0,asset_path=NULL,original_path=NULL,mime_type=NULL,size_bytes=NULL,updated_at=? WHERE id=?')
          .run(item.title, item.kind, String(item.source || new URL(url).hostname).slice(0,300), url, String(item.excerpt || '').slice(0,2000), JSON.stringify(item.tags.map(tag=>tag.trim()).filter((tag,i,all)=>tag&&all.findIndex(value=>value.toLowerCase()===tag.toLowerCase())===i)), item.content, item.preview || null, JSON.stringify(origin), origin.importedAt, id);
      } else id = insert(item, {}, new Map()).item.id;
      const result = { saved: true, id, replaced: Boolean(existing) };
      db.prepare('INSERT INTO app_meta(key,value) VALUES (?,?)').run(key, JSON.stringify({ digest, result }));
      db.prepare("DELETE FROM app_meta WHERE key GLOB 'browser_capture_receipt_v1:*' AND rowid NOT IN (SELECT rowid FROM app_meta WHERE key GLOB 'browser_capture_receipt_v1:*' ORDER BY rowid DESC LIMIT 256)").run();
      db.exec('COMMIT'); return result;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return { lookupCapture, saveCapture, captureTags };
}
