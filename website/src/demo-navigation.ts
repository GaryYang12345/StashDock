import type { StashItem } from '../../src/types';

/** The website can open public sources, but never promises access to local files. */
export function demoLink(item: StashItem): string | undefined {
  if (item.kind !== 'web' && item.kind !== 'repo') return;
  try {
    const url = new URL(item.url || '');
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch { /* A missing or invalid source has no Open action. */ }
}

export function demoCard(item: StashItem): StashItem {
  const { assetPath: _asset, originalPath: _original, hasFile: _file, url: _url, ...display } = item;
  return { ...display, url: demoLink(item) };
}

export function openDemoReference(item: StashItem) {
  const url = demoLink(item);
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}
