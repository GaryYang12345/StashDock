import type { CollectionFilter, StashItem } from "../../types";

type Session = {
  query: string; filter: CollectionFilter; activeTag: string | null;
  selectedIds: string[]; view: "grid" | "list";
  copied: boolean; copiedItemId: string | null; refreshing: boolean;
  notice: string | null;
  search: { query: string; items: StashItem[]; results: string[] | null } | null;
};
type Update<T> = T | ((current: T) => T);

/** UI state belongs to the shelf, not to its compact/expanded presentation. */
export function createLibrarySession() {
  let state: Session = { query: "", filter: "all", activeTag: null, selectedIds: [], view: "grid", copied: false, copiedItemId: null, refreshing: false, notice: null, search: null };
  const listeners = new Set<() => void>();
  const timers = new Map<"copied" | "copiedItemId" | "notice", ReturnType<typeof setTimeout>>();
  let refreshFlight: Promise<void> | null = null;
  const update = <K extends keyof Session>(key: K, value: Update<Session[K]>) => {
    const next = typeof value === "function" ? (value as (current: Session[K]) => Session[K])(state[key]) : value;
    if (Object.is(next, state[key])) return;
    state = { ...state, [key]: next, ...(key === "selectedIds" ? { copied: false } : {}) };
    listeners.forEach(listener => listener());
  };
  const transient = <K extends "copied" | "copiedItemId" | "notice">(key: K, value: Session[K], duration = 0) => {
    clearTimeout(timers.get(key));
    update(key, value);
    if (duration) timers.set(key, setTimeout(() => {
      if (key === "copied") update("copied", false);
      else if (key === "copiedItemId") update("copiedItemId", null);
      else update("notice", null);
      timers.delete(key);
    }, duration));
  };
  const navigate = (filter: CollectionFilter, activeTag: string | null) => {
    if (state.filter === filter && state.activeTag === activeTag) return;
    // A collection and a tag are alternative navigation destinations, not
    // hidden intersecting filters. Publish the whole destination atomically.
    state = { ...state, filter, activeTag };
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setQuery: (value: string) => update("query", value),
    setFilter: (value: CollectionFilter) => navigate(value, null),
    setActiveTag: (value: string | null) => navigate(value ? 'all' : state.filter, value),
    setSelectedIds: (value: Update<string[]>) => update("selectedIds", value),
    setView: (value: "grid" | "list") => update("view", value),
    setCopied: (value: boolean, duration = 0) => transient("copied", value, duration),
    setCopiedItemId: (value: string | null, duration = 0) => transient("copiedItemId", value, duration),
    setNotice: (value: string | null, duration = 0) => transient("notice", value, duration),
    setSearch: (value: Session["search"]) => update("search", value),
    prune: (validIds: Set<string>) => {
      if (state.selectedIds.some(id => !validIds.has(id))) update("selectedIds", state.selectedIds.filter(id => validIds.has(id)));
      if (state.copiedItemId && !validIds.has(state.copiedItemId)) transient("copiedItemId", null);
    },
    refresh: (load: () => Promise<void>) => {
      if (refreshFlight) return refreshFlight;
      update("refreshing", true);
      refreshFlight = Promise.resolve().then(load).finally(() => { refreshFlight = null; update("refreshing", false); });
      return refreshFlight;
    },
    dispose: () => { timers.forEach(clearTimeout); listeners.clear(); },
  };
}
