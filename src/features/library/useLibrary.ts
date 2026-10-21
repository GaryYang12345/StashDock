import { useEffect, useSyncExternalStore } from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { deleteItem, loadItems, saveItems, setItemFavorite } from "../../lib/storage";
import { createLibraryStore, type ImportSummary } from "./store";

export const libraryStore = createLibraryStore({
  load: loadItems,
  add: async (items, next) => {
    await saveItems(isTauri() ? items : next);
    return isTauri() ? loadItems() : next;
  },
  remove: (id, next) => isTauri() ? deleteItem(id) : saveItems(next),
  removeMany: async (ids, next) => { if (isTauri()) await invoke('delete_items', { ids }); else await saveItems(next); },
  favorite: (id, value, next) => isTauri() ? setItemFavorite(id, value) : saveItems(next),
  edit: async (id, title, tags, next, cover) => {
    if (isTauri()) return invoke('edit_item', { id, title, tags, ...(cover ? { cover } : {}) });
    await saveItems(next); return next;
  },
  changeTag: async (name, replacement, next) => {
    if (isTauri()) return invoke('change_library_tag', { name, replacement });
    await saveItems(next); return next;
  },
  editContent: async (id, content, next) => {
    if (isTauri()) return invoke('edit_item_content', { id, content });
    await saveItems(next); return next;
  },
});

// One listener lifetime for all mounted desktop consumers.
let consumers = 0;
let disconnect: (() => void) | undefined;
function connect() {
  if (consumers++ === 0) {
    let cancelled = false;
    const stops: UnlistenFn[] = [];
    const refresh = () => { if (!document.hidden) void libraryStore.invalidate(); };
    if (isTauri()) {
      for (const name of ["extension-imported", "extension-deleted", "reference-preview-updated"]) {
        void listen<ImportSummary>(name, event => {
          if (cancelled) return;
          void libraryStore.invalidate();
          if (name === "extension-imported") libraryStore.announceImport(event.payload);
        }).then(stop => {
          if (cancelled) stop(); else stops.push(stop);
        }).catch(console.warn);
      }
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    disconnect = () => {
      cancelled = true;
      stops.forEach(stop => stop());
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
    void libraryStore.refresh();
  }
  return () => { if (--consumers === 0) { disconnect?.(); disconnect = undefined; } };
}

export function useLibrary() {
  const snapshot = useSyncExternalStore(libraryStore.subscribe, libraryStore.getSnapshot);
  useEffect(connect, []);
  return { ...snapshot, refresh: libraryStore.refresh };
}
