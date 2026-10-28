import { invoke, isTauri } from "@tauri-apps/api/core";
import { seedItems } from "../data/seed";
import type { StashItem } from "../types";
import { matchesSearchTerms, referenceSearchText, searchTerms } from "./reference-search.mjs";
import type { ChosenFile, ChosenFileDraft, FileReferencePayload } from './fileReference';

export async function importReferenceFiles(files: FileReferencePayload[], tags: string[]): Promise<StashItem[]> {
  return invoke<StashItem[]>('import_file_payloads', { files, tags });
}
/** System file dialog: chosen files are saved as references to their originals. */
export function chooseReferenceFiles(): Promise<ChosenFile[]> {
  return invoke<ChosenFile[]>('choose_reference_files');
}
export function importChosenReferenceFiles(files: ChosenFileDraft[], tags: string[]): Promise<StashItem[]> {
  return invoke<StashItem[]>('import_chosen_files', { files, tags });
}

const STORAGE_KEY = "stashdock.items.v1";

// Demonstration references belong only to the browser-only UI workbench.
// A desktop library migrates genuine legacy WebView data or starts empty.
function loadLegacyItems(fallback: StashItem[]): StashItem[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as StashItem[]) : fallback;
  } catch {
    return fallback;
  }
}

let initialization: Promise<void> | undefined;
export async function loadItems(): Promise<StashItem[]> {
  if (!isTauri()) return loadLegacyItems(seedItems);
  if (!initialization) {
    initialization = invoke<void>("initialize_library", { items: loadLegacyItems([]) });
    try { await initialization; }
    catch (error) { initialization = undefined; throw error; }
  }
  else await initialization;
  return invoke<StashItem[]>("list_items");
}

export async function saveItems(items: StashItem[]) {
  if (!isTauri()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return;
  }

  await invoke("save_items", { items });
}

/** Desktop shelf rows omit bodies; read a few references by ID (with bodies when `full`). */
export function getItems(ids: string[], full = false): Promise<StashItem[]> {
  return invoke<StashItem[]>('get_items', { ids, full });
}

export async function deleteItem(id: string) {
  if (!isTauri()) return;
  await invoke("delete_item", { id });
}

export async function setItemFavorite(id: string, favorite: boolean): Promise<void> {
  await invoke("set_item_favorite", { id, favorite });
}

/** Ordered IDs of references matching every query term (shared contract in reference-search.mjs). */
export async function searchItems(query: string, items: StashItem[]): Promise<string[]> {
  const terms = searchTerms(query);
  if (!terms.length) return items.map(item => item.id);
  if (!isTauri()) return items.filter(item => matchesSearchTerms(referenceSearchText(item), terms)).map(item => item.id);
  return invoke<string[]>("search_items", { query });
}
