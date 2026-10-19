// The same allowlisted destinations are used by both hosts. Opening a site is
// navigation, not connecting an account or importing its collection.
export const captureSites = [
  { id: 'x', name: 'X', url: 'https://x.com/', host: 'x.com' },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/', host: 'instagram.com' },
  { id: 'reddit', name: 'Reddit', url: 'https://www.reddit.com/', host: 'reddit.com' },
  { id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/', host: 'linkedin.com' },
  { id: 'pinterest', name: 'Pinterest', url: 'https://www.pinterest.com/', host: 'pinterest.com' },
  { id: 'xiaohongshu', name: 'Xiaohongshu', url: 'https://www.xiaohongshu.com/', host: 'xiaohongshu.com' },
  { id: 'zhihu', name: 'Zhihu', url: 'https://www.zhihu.com/', host: 'zhihu.com' },
] as const;
export type CaptureSiteId = typeof captureSites[number]['id'];
export type CapturePlatform = { id: string; name: string; url: string; host: string };

// Navigation only. No credentials, executable protocols or browser profiles.
export function customCapturePlatform(raw: string): CapturePlatform {
  const value = raw.trim();
  if (!value || value.length > 2048) throw Error('Enter a website link up to 2,048 characters.');
  let url: URL;
  try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`); }
  catch { throw Error('Enter a valid website link.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.'))
    throw Error('Use an http:// or https:// website link without sign-in credentials.');
  const host = url.hostname.replace(/^www\./, '');
  return { id: `custom:${url.href}`, name: host, host, url: url.href };
}
