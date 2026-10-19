import { invoke } from '@tauri-apps/api/core';
import type { StashItem } from '../types';

export type ReferenceCover = { preview: string; name: string };
/** Missing means unchanged; null preview explicitly restores the default. */
export type ReferenceCoverEdit = { preview: string | null };
export type PrepareReferenceCover = (file: File) => Promise<string>;
export const COVER_FILE_LIMIT = 5_000_000;
export const COVER_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif';

/** Prepare only a bounded thumbnail. Choosing a cover never writes a reference. */
export async function readReferenceCover(file: File): Promise<string> {
  if (!file.size || file.size > COVER_FILE_LIMIT) throw Error('Choose an image under 5 MB.');
  if (!/\.(png|jpe?g|webp|gif)$/i.test(file.name)) throw Error('Choose a PNG, JPG, WebP or GIF image.');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(Error('The image could not be read. Choose it again.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
}

export async function prepareReferenceCover(file: File): Promise<string> {
  return invoke<string>('prepare_cover_image', { base64: await readReferenceCover(file) });
}

export function editReferenceCover(item: StashItem, edit?: ReferenceCoverEdit): StashItem {
  if (!edit) return item;
  if (edit.preview !== null) return withReferenceCover(item, { preview: edit.preview, name: 'Custom image' });
  const origin = { ...item.origin };
  delete origin.previewSource; delete origin.previewKind;
  return { ...item, preview: undefined, origin: item.origin ? origin as StashItem['origin'] : undefined };
}

export function withReferenceCover(item: StashItem, cover: ReferenceCover | null): StashItem {
  if (!cover) return item;
  return { ...item, preview: cover.preview, origin: { ...item.origin!, previewKind: 'cover', previewSource: 'custom' } };
}
