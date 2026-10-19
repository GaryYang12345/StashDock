import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';

const key = 'stashdock.desktop-pinned-tags.v1';
export function replacePinnedTag(tags: string[], name: string, replacement: string | null) {
  const seen = new Set<string>();
  return tags.flatMap(tag => tag.toLowerCase() === name.toLowerCase() ? replacement ? [replacement] : [] : [tag])
    .filter(tag => !seen.has(tag.toLowerCase()) && Boolean(seen.add(tag.toLowerCase())));
}
function readBrowser(): string[] {
  const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
  if (!Array.isArray(value) || value.some(tag => typeof tag !== 'string')) throw Error('Pinned tags could not be loaded. Retry.');
  return value;
}

export function usePinnedTags(onError: (message: string) => void) {
  const [pinnedTags, setPinnedTags] = useState<string[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback((task: () => Promise<string[]>) => {
    const next = queue.current.catch(() => {}).then(task).then(tags => { setPinnedTags(tags); return tags; });
    queue.current = next;
    return next;
  }, []);
  useEffect(() => {
    void enqueue(async () => isTauri() ? invoke<string[]>('list_pinned_tags') : readBrowser()).catch(() => onError('Pinned tags could not be loaded. Reopen the dashboard to retry.'));
  }, [enqueue, onError]);
  const pinTag = useCallback((name: string, pinned: boolean) => enqueue(async () => {
    if (isTauri()) return invoke<string[]>('set_tag_pinned', { name, pinned });
    const next = replacePinnedTag(readBrowser(), name, null);
    if (pinned) next.push(name);
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  }), [enqueue]);
  const reconcileTag = useCallback((name: string, replacement: string | null) => enqueue(async () => {
    if (isTauri()) return invoke<string[]>('list_pinned_tags'); // Native transaction already renamed/unpinned it.
    const next = replacePinnedTag(readBrowser(), name, replacement);
    localStorage.setItem(key, JSON.stringify(next)); return next;
  }), [enqueue]);
  return { pinnedTags, pinTag, reconcileTag };
}
