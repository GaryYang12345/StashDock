import { createHash } from 'node:crypto';
import { buildContext, referenceFileName } from '../../../src/lib/context-format.mjs';
import { matchesSearchTerms, referenceSearchText, searchTerms } from '../../../src/lib/reference-search.mjs';

export function summary(item) {
  return {
    id: item.id, title: item.title, kind: item.kind, source: item.source,
    url: item.url, excerpt: item.excerpt, tags: item.tags || [], createdAt: item.createdAt,
    favorite: Boolean(item.favorite), origin: item.origin,
    mimeType: item.mimeType, hasFile: Boolean(item.assetPath || item.hasFile), tagRevision: tagRevision(item),
  };
}

export function tagRevision(item) {
  return createHash('sha256').update(JSON.stringify([
    item.id, (item.tags || []).map(value => String(value)),
  ])).digest('hex');
}

export function detail(item) {
  return { ...summary(item), content: item.content || item.excerpt || '', context: buildContext([item]), assetPath: item.assetPath,
    originalPath: item.originalPath, mimeType: item.mimeType, sizeBytes: item.sizeBytes };
}

// rankedIds comes from the shared SQLite index (search-index.mjs). Without it
// (isolated fixtures), the same term contract runs over in-memory text.
export function search(items, { query = '', tag = '', favoriteOnly = false, collection = 'all', limit = 10, offset = 0, rankedIds } = {}) {
  const terms = searchTerms(query);
  const tagValue = tag.trim().toLocaleLowerCase('en');
  const now = Date.now();
  const rank = terms.length && rankedIds ? new Map(rankedIds.map((id, index) => [id, index])) : null;
  const matches = items.filter(item => !favoriteOnly || item.favorite)
    .filter(item => collection === 'recent' ? Date.parse(item.createdAt) >= now - 7 * 24 * 60 * 60 * 1000
      : collection === 'web' ? ['web', 'repo'].includes(item.kind)
      : collection === 'files' ? Boolean(item.assetPath || item.hasFile || ['file', 'pdf', 'image'].includes(item.kind))
      : collection === 'favorites' ? Boolean(item.favorite) : true)
    .filter(item => !tagValue || (item.tags || []).some(value => String(value).toLocaleLowerCase('en') === tagValue))
    .filter(item => !terms.length || (rank ? rank.has(item.id) : matchesSearchTerms(referenceSearchText(item), terms)))
    .sort((a, b) => rank ? rank.get(a.id) - rank.get(b.id) : String(b.createdAt).localeCompare(String(a.createdAt)));
  return { items: matches.slice(offset, offset + limit), hasMore: offset + limit < matches.length };
}

// Original-site favicon images only. Never authorize local network endpoints,
// credentials, arbitrary schemes or wildcard CSP origins; no server-side fetch.
export function publicImageUrl(raw, base) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 32768) return;
  try {
    const url = new URL(raw, base);
    const host = url.hostname.toLowerCase();
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || !host.includes('.') ||
      host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') ||
      /^[\d.]+$/.test(host) || host.includes(':')) return;
    return url.href;
  } catch { /* Invalid image source. */ }
}

export function faviconOrigins(items) {
  return [...new Set(items.flatMap(item => [publicImageUrl(item.url), publicImageUrl(item.origin?.faviconUrl, item.url)])
    .filter(Boolean).map(value => new URL(value).origin))].sort();
}

// Preview remains embedded raster data. Favicon URLs must match the exact
// origins declared when the host reads the App resource. New sites require
// reopening the App to refresh CSP, rather than silently broadening access.
export function visualSummary(item, resourceDomains = []) {
  const result = summary(item);
  const raster = /^data:image\/(?:png|jpeg|webp|gif|x-icon|vnd\.microsoft\.icon);base64,[a-z\d+/=]+$/i;
  const safeImage = value => typeof value === 'string' && value.length <= 750_000 && raster.test(value) ? value : undefined;
  const favicon = publicImageUrl(item.origin?.faviconUrl, item.url);
  const allowedFavicon = favicon && resourceDomains.includes(new URL(favicon).origin) ? favicon : undefined;
  return { ...result, previewStatus: item.previewStatus, contentStatus: item.contentStatus, preview: safeImage(item.preview), origin: result.origin
    ? { ...result.origin, faviconUrl: safeImage(result.origin.faviconUrl) || allowedFavicon } : undefined };
}

export function prepareAttachment(items, ids) {
  const unique = [...new Set(ids)];
  if (!unique.length || unique.length > 30) throw new Error('Select between 1 and 30 references.');
  const selected = unique.map(id => {
    const item = items.find(value => value.id === id);
    if (!item) throw new Error('A selected reference is no longer available. Refresh the shelf and try again.');
    return item;
  });
  const title = selected.length === 1 ? selected[0].title : `StashDock references (${selected.length})`;
  const files = selected.filter(item => item.assetPath || item.hasFile);
  // Delivery instructions are separate from user-editable reference content.
  // Even an intentionally empty final edit must not erase original-file access.
  const text = (files.length ? [
    '# StashDock original files',
    'Original files are available through the reading tool below, not attached by this context message. File descriptions are supplemental, not the file contents. Note text, when included, is a saved text projection.',
    'Before answering about a file, call get_stashdock_file with its reference ID, then read the returned path using the host\'s file tools and the appropriate skill (for example spreadsheets for Excel). Do not execute files or macros.',
    'If a file cannot be read, say which original was not read and why. Never infer its contents from the title, excerpt or path.',
    ...files.map(item => JSON.stringify({ referenceId: item.id, title: item.title, filename: referenceFileName(item), mimeType: item.mimeType })),
    '',
  ].join('\n') + '\n' : '') + buildContext(selected);
  if (Buffer.byteLength(text, 'utf8') > 2_000_000) throw new Error('These references are too large for one attachment. Add fewer references at a time.');
  const hash = createHash('sha256').update(text).digest('hex');
  const filename = `${String(title).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 90) || 'StashDock references'}.md`;
  return {
    title, ids: unique,
    content: [{ type: 'resource', resource: {
      uri: `stashdock://snapshot/${hash}/${encodeURIComponent(filename)}`,
      mimeType: 'text/markdown', text,
      _meta: { title, filename },
    } }],
  };
}
