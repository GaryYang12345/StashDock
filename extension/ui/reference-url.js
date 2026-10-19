// One reference identity for desktop imports, MCP persistence and browser capture.
// This only normalizes identity; public-network validation belongs to fetch adapters.
const trackingKeys = new Set(['fbclid', 'gclid', 'dclid', 'mc_cid', 'mc_eid', 'igshid']);

export function canonicalReferenceUrl(raw) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use an http or https URL without credentials.');
  }
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || trackingKeys.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  if (!url.searchParams.size) url.search = '';
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.href;
}
