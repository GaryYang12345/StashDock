import type { StashItem } from "../types";
import { invoke, isTauri } from '@tauri-apps/api/core';
import { buildContext } from './context-format.mjs';
export { buildContext } from './context-format.mjs';

export async function copyContext(items: StashItem[]) {
  if (isTauri()) {
    await invoke('copy_reference_file', { itemIds: items.map(item => item.id) });
    return;
  }
  // Browser previews cannot publish native filesystem clipboard formats.
  await navigator.clipboard.writeText(buildContext(items));
}
