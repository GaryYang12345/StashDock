import type { StashItem } from '../../types';

/** Check invalidation between pages, not only before publishing the result. */
export async function readPreviewPages(count: number, read: (offset: number) => Promise<StashItem[]>, current: () => boolean) {
  const rows: StashItem[] = [];
  for (let offset = 0; offset < count; offset += 30) {
    if (!current()) return null;
    const page = await read(offset);
    if (!current()) return null;
    rows.push(...page);
  }
  return rows;
}
