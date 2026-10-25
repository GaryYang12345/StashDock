import { useMemo, useState } from 'react';
import type { StashItem } from '../../src/types';
import type { ReferenceCoverEdit } from '../../src/lib/referenceCover';
import { editReferenceCover } from '../../src/lib/referenceCover';
import { cleanReferenceTags } from '../../src/features/library/store';
import type { Language } from './copy';
import { demoLibrary } from './demo-data';

export function editDemoCard(item: StashItem, original: StashItem, title: string, tags: string[], cover?: ReferenceCoverEdit): StashItem {
  title = title.trim();
  if (!title || title.length > 500) throw Error('Use a title between 1 and 500 characters.');
  const next = editReferenceCover({ ...item, title, tags: cleanReferenceTags(tags) }, cover);
  // A static demo restores its bundled screenshot, without asking a local app
  // to regenerate it. Selecting a new cover still requires an explicit Save.
  return cover?.preview === null ? { ...next, preview: original.preview } : next;
}

export function editDemoContent(item: StashItem, content: string): StashItem {
  if (content.length > 200_000) throw Error('Use at most 200,000 characters.');
  return { ...item, contextOverride: content };
}

/** In-memory website samples only. No local library, server writes or storage. */
export function useDemoLibrary(language: Language) {
  const source = useMemo(() => demoLibrary(language), [language]);
  const [changes, setChanges] = useState<Record<string, StashItem>>({});
  const library = useMemo(() => source.map(item => changes[item.id] ?? item), [source, changes]);
  const saveCard = async (id: string, title: string, tags: string[], cover?: ReferenceCoverEdit) => {
    const original = source.find(item => item.id === id);
    if (!original) throw Error('This reference no longer exists.');
    const next = editDemoCard(changes[id] ?? original, original, title, tags, cover);
    setChanges(current => ({ ...current, [id]: next }));
  };
  const saveContent = async (id: string, content: string) => {
    const item = library.find(item => item.id === id);
    if (!item) throw Error('This reference no longer exists.');
    const next = editDemoContent(item, content);
    setChanges(current => ({ ...current, [id]: next }));
  };
  return { library, saveCard, saveContent, edited: Object.keys(changes).length > 0, resetEdits: () => setChanges({}) };
}
