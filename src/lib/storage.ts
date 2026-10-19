import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { seedItems } from "../data/seed";
import type { StashItem } from "../types";
import type { FileReferencePayload } from './fileReference';

export async function importReferenceFiles(files: FileReferencePayload[], tags: string[]): Promise<StashItem[]> {
  return invoke<StashItem[]>('import_file_payloads', { files, tags });
}

const STORAGE_KEY = "stashdock.items.v1";

function loadLegacyItems(): StashItem[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as StashItem[]) : seedItems;
  } catch {
    return seedItems;
  }
}

let initialization: Promise<void> | undefined;
export async function loadItems(): Promise<StashItem[]> {
  if (!isTauri()) return loadLegacyItems();
  if (!initialization) {
    initialization = invoke<void>("initialize_library", { items: loadLegacyItems() });
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

export async function deleteItem(id: string) {
  if (!isTauri()) return;
  await invoke("delete_item", { id });
}

export async function setItemFavorite(id: string, favorite: boolean): Promise<void> {
  await invoke("set_item_favorite", { id, favorite });
}

export async function searchItems(query: string, items: StashItem[]): Promise<StashItem[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;

  if (!isTauri()) {
    return items.filter((item) =>
      [item.title, item.source, item.excerpt, item.assetPath || item.hasFile ? item.content : item.contextOverride ?? item.content, item.contextOverride, ...item.tags]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }

  return invoke<StashItem[]>("search_items", { query });
}

export async function chooseAndImportFiles(tags?: string[]): Promise<StashItem[]> {
  if (!isTauri()) return [];

  const selected = await open({
    multiple: true,
    directory: false,
    title: "Add files to StashDock",
    filters: [
      {
        name: "Context files",
        extensions: [
          "pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "md", "mdx", "txt", "json", "csv", "log",
          "toml", "yaml", "yml", "xml", "html", "css", "js", "jsx", "ts", "tsx", "rs", "py", "go", "java",
          "c", "h", "cpp", "hpp", "sql", "sh", "ps1",
        ],
      },
      { name: "All files", extensions: ["*"] },
    ],
  });

  if (!selected) return [];
  const paths = Array.isArray(selected) ? selected : [selected];
  return invoke<StashItem[]>("import_files", { paths, tags });
}
