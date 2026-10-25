import { useRef, useState, type ComponentProps } from 'react';
import { ReferenceEditor } from '../../../src/components/ReferenceEditor';
import { ContentEditor } from '../../../src/components/ContentEditor';
import { readReferenceCover } from '../../../src/lib/referenceCover';
import type { StashItem } from '../../../src/types';

// The real product forms, menus, focus handling and Markdown preview. The only
// adapter is saving into this demo's memory instead of the installed library.
export function useDemoReferenceEditors({ library, saveCard, saveContent }: {
  library: StashItem[];
  saveCard: ComponentProps<typeof ReferenceEditor>['onSave'];
  saveContent: ComponentProps<typeof ContentEditor>['onSave'];
}) {
  const [editing, setEditing] = useState<{ id: string; content: boolean } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const open = (item: StashItem, content: boolean) => {
    returnFocus.current = [...document.querySelectorAll<HTMLElement>('article[data-reference-id]')]
      .find(card => card.dataset.referenceId === item.id && card.dataset.menuOpen)
      ?.querySelector<HTMLElement>('[data-card-menu]') ?? null;
    setEditing({ id: item.id, content });
  };
  const item = library.find(item => item.id === editing?.id) ?? null;
  const close = () => setEditing(null);
  return {
    openCard: (item: StashItem) => open(item, false),
    openContent: (item: StashItem) => open(item, true),
    dialogs: <>
      <ReferenceEditor item={editing && !editing.content ? item : null} availableTags={[...new Set(library.flatMap(item => item.tags))].sort()}
        prepareCover={prepareDemoCover} returnFocus={returnFocus} onClose={close} onSave={saveCard} />
      <ContentEditor item={editing?.content ? item : null} returnFocus={returnFocus} onClose={close} onSave={saveContent} />
    </>,
  };
}

async function prepareDemoCover(file: File): Promise<string> {
  // Share file validation with the product, then rasterize a small, inert JPEG
  // in the browser. The selected image is never uploaded anywhere.
  const base64 = await readReferenceCover(file);
  const image = new Image();
  image.src = `data:${file.type || 'image/png'};base64,${base64}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 720; canvas.height = 405;
  const painter = canvas.getContext('2d');
  if (!painter) throw Error('The image could not be read. Choose another image.');
  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  painter.drawImage(image, (canvas.width - image.naturalWidth * scale) / 2, (canvas.height - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
  return canvas.toDataURL('image/jpeg', .85);
}
