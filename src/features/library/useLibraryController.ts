import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copyContext } from "../../lib/context";
import { openExternalUrl } from "../../lib/external";
import { searchItems } from "../../lib/storage";
import { invoke } from '@tauri-apps/api/core';
import { libraryStore, useLibrary } from "./useLibrary";
import { librarySession, useLibrarySession } from "./useLibrarySession";
import { buildSearchIndex, filterItems, selectItems, summarizeItems } from "./selectors";
import type { StashItem } from "../../types";
import { useI18n } from '../settings/locale';
import { referenceOpenTarget } from '../../lib/referenceOpen';
import type { ReferenceImportHandle } from '../../components/ReferenceImportDialog';

export function useLibraryController(active: boolean, allowImport = true, editing = false) {
  const { t } = useI18n();
  const { items, ready: storageReady, error, refresh: load } = useLibrary();
  const { filter, setFilter, activeTag, setActiveTag, query, setQuery, selectedIds, setSelectedIds, view, setView, copied, setCopied, copiedItemId, setCopiedItemId, refreshing, notice, setNotice, search, setSearch } = useLibrarySession();
  const refresh = () => librarySession.refresh(load);
  const importDialog = useRef<ReferenceImportHandle>(null);
  const [pendingDelete, setPendingDelete] = useState<StashItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!active) return;
    const failedDrag = (event: Event) => {
      const message = (event as CustomEvent<unknown>).detail;
      setNotice(typeof message === "string" ? message : "Reference drag failed. Try Copy for AI or refresh the library.", 5000);
    };
    window.addEventListener("reference-drag-error", failedDrag);
    return () => window.removeEventListener("reference-drag-error", failedDrag);
  }, [active, setNotice]);

  useEffect(() => { if (!active) setPendingDelete(null); }, [active]);


  useEffect(() => {
    if (!active || !storageReady || !query.trim()) {
      return;
    }
    const cached = librarySession.getSnapshot().search;
    if (cached?.query === query && cached.items === items) return;

    let current = true;
    const timer = window.setTimeout(() => {
      void searchItems(query, items)
        .then((results) => {
          if (current) setSearch({ query, items, results });
        })
        .catch(() => {
          if (!current) return;
          setSearch({ query, items, results: [] });
          setNotice("Search could not read the local index.", 3200);
        });
    }, 140);

    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [active, items, query, storageReady, setNotice, setSearch]);

  const { counts, tags } = useMemo(() => summarizeItems(items), [items]);
  const searchIndex = useMemo(() => buildSearchIndex(items), [items]);
  const resultIds = useMemo(() => search?.query === query && search.items === items ? new Set(search.results.map(item => item.id)) : null, [search, query, items]);
  const visibleItems = useMemo(() => filterItems(items, searchIndex, query, filter, activeTag, resultIds), [items, searchIndex, query, filter, activeTag, resultIds]);
  const selectedItems = useMemo(() => selectItems(items, selectedIds), [items, selectedIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleSelection = useCallback((id: string) => {
    setCopied(false);
    setSelectedIds((current) => (current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]));
  }, [setCopied]);

  const toggleFavorite = useCallback((id: string) => {
    void libraryStore.toggleFavorite(id).catch(() => setNotice("This favorite could not be saved.", 3200));
  }, [setNotice]);

  const handleDelete = useCallback((item: StashItem) => {
    setDeleteError(""); setPendingDelete(item);
  }, []);
  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true); setDeleteError("");
    try {
      await libraryStore.remove(pendingDelete.id);
      setSelectedIds((current) => current.filter((id) => id !== pendingDelete.id));
      setPendingDelete(null);
      setNotice("Reference deleted.", 2200);
    } catch {
      setDeleteError("This reference could not be deleted. Try again.");
    } finally { setDeleting(false); }
  };

  const handleOpenItem = useCallback(async (item: StashItem) => {
    const target = referenceOpenTarget(item);
    if (!target) return;
    try {
      if (target === 'link') await openExternalUrl(item.url!);
      else await invoke('open_reference_file', { id: item.id });
    } catch {
      setNotice(item.url ? 'This page could not be opened in your default browser.' : 'This file could not be opened. Check that its app is installed and the file still exists.', 3200);
    }
  }, [setNotice]);

  const addItems = async (newItems: StashItem[], persisted = false) => {
    const { imported, skipped } = await libraryStore.add(newItems, persisted);
    setFilter("all");
    setActiveTag(null);
    setNotice(
      imported
        ? `${t('{count} references imported', { count: imported })}${skipped ? ` · ${t('{count} duplicates skipped', { count: skipped })}` : ''}`
        : "Everything in this import is already in StashDock.",
      2600,
    );
  };

  const handleCopy = useCallback(async () => {
    if (!selectedItems.length) return;
    const selection = librarySession.getSnapshot().selectedIds;
    setCopied(false);
    try {
      await copyContext(selectedItems);
      if (librarySession.getSnapshot().selectedIds === selection) setCopied(true, 1800);
    } catch {
      setNotice("Clipboard access was blocked. Try again from the active window.", 3200);
    }
  }, [selectedItems, setCopied, setNotice]);

  const handleCopyItem = useCallback(async (item: StashItem) => {
    setCopiedItemId(null);
    try {
      await copyContext([item]);
      setCopiedItemId(item.id, 1800);
    } catch {
      setNotice("Clipboard access was blocked. Try again from the active window.", 3200);
    }
  }, [setCopiedItemId, setNotice]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!active || importDialog.current?.isOpen() || editing) return;
      if (pendingDelete) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
      if (allowImport && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") { event.preventDefault(); importDialog.current?.open(); }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && selectedItems.length) { event.preventDefault(); void handleCopy(); }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [active, allowImport, editing, pendingDelete, handleCopy, selectedItems.length]);

  return { storageReady, error, refresh, refreshing, filter, setFilter, activeTag, setActiveTag, query, setQuery, selectedItems, selectedSet, setSelectedIds, view, setView, importDialog, copied, copiedItemId, notice, setNotice, searchRef, counts, tags, visibleItems, toggleSelection, toggleFavorite, handleDelete, pendingDelete, setPendingDelete, deleting, deleteError, confirmDelete, handleOpenItem, addItems, handleCopy, handleCopyItem };
}
