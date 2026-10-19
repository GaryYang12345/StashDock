import type { StashItem } from '../types';

/** Every file-backed reference uses the same system-file action. */
export function referenceOpenTarget(item: StashItem): 'link' | 'file' | null {
  if (item.assetPath || item.hasFile) return 'file';
  if (item.url) return 'link';
  return null;
}
