import { useSyncExternalStore } from "react";
import { createLibrarySession } from "./session";
import { libraryStore } from "./useLibrary";

export const librarySession = createLibrarySession();
let lastImportNotice = libraryStore.getSnapshot().importNotice;
const stop = libraryStore.subscribe(() => {
  const { items, ready, importNotice } = libraryStore.getSnapshot();
  if (ready) librarySession.prune(new Set(items.map(item => item.id)));
  if (importNotice && importNotice !== lastImportNotice) librarySession.setNotice(importNotice.message, 3200);
  lastImportNotice = importNotice;
});
if (import.meta.hot) import.meta.hot.dispose(() => { stop(); librarySession.dispose(); });

export function useLibrarySession() {
  const state = useSyncExternalStore(librarySession.subscribe, librarySession.getSnapshot);
  return { ...librarySession, ...state };
}
