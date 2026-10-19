import type { StashItem } from '../types';

function sameReference(left: StashItem, right: StashItem) {
  return Object.keys({ ...left, ...right }).every(key => {
    const field = key as keyof StashItem;
    if (left[field] === right[field]) return true;
    if (field === 'tags') return left.tags.length === right.tags.length && left.tags.every((tag, i) => tag === right.tags[i]);
    if (field === 'origin') return JSON.stringify(left.origin) === JSON.stringify(right.origin);
    return false;
  });
}

/** Preserve unchanged rows and arrays so polling does not restart UI work.
 * Replace owns order; append deduplicates; update preserves loaded pages. */
export function reconcileReferences(previous: StashItem[], incoming: StashItem[], mode: 'replace' | 'append' | 'update' = 'replace'): StashItem[] {
  const old = new Map(previous.map(item => [item.id, item]));
  const updates = new Map(incoming.map(item => [item.id, item]));
  const next = mode === 'update' ? previous.map(item => updates.get(item.id) ?? item)
    : mode === 'append' ? [...previous.map(item => updates.get(item.id) ?? item), ...[...updates.values()].filter(item => !old.has(item.id))]
    : [...updates.values()];
  const reconciled = next.map(item => {
    const before = old.get(item.id);
    return before && sameReference(before, item) ? before : item;
  });
  return previous.length === reconciled.length && reconciled.every((item, i) => item === previous[i]) ? previous : reconciled;
}
