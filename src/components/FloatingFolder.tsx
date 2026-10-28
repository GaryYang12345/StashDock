import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FolderArtwork } from "./FolderArtwork";
import { FolderCloseArtwork } from "./FolderCloseArtwork";
import { beginFloatingDrag, hideStashDock } from "../lib/desktopWindows";
import styles from "./FloatingFolder.module.css";
import { useI18n } from '../features/settings/locale';

type Props = { onOpen: () => boolean | void | Promise<boolean | void>; onMoved?: () => void };

export function FloatingFolder({ onOpen, onMoved }: Props) {
  const { t } = useI18n();
  const pending = useRef(false);
  const [error, setError] = useState("");
  // The folder search opens on hover; the folder stays raised while it is out.
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    if (!isTauri()) return;
    let stopped = false, cleanup: (() => void) | undefined, settle: number | undefined;
    // Lower only after the search has folded back in (its exit is ~0.25 s).
    void listen<{ open: boolean }>("folder-search-state", event => {
      if (stopped) return;
      window.clearTimeout(settle);
      if (event.payload.open) setSearchOpen(true); else settle = window.setTimeout(() => setSearchOpen(false), 260);
    }).then(stop => { if (stopped) stop(); else cleanup = stop; });
    return () => { stopped = true; window.clearTimeout(settle); cleanup?.(); };
  }, []);
  const hover = (inside: boolean) => { if (isTauri()) void invoke("folder_search_pointer", { inside }).catch(() => {}); };
  const activate = async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      setError("");
      if (await onOpen() === false) throw new Error("Window transition failed");
    } catch { setError("Could not open StashDock. Please try again."); }
    finally { pending.current = false; }
  };
  return <main className="floating-folder-root" data-search-open={searchOpen || undefined} onPointerEnter={() => hover(true)} onPointerLeave={() => hover(false)}>
    <div className="floating-folder-surface">
    <button type="button" className="floating-folder-button" aria-label={t('Open StashDock')}
      aria-description={t('Click to open. Drag to move.')}
      onPointerDown={async event => {
        if (event.button !== 0 || !isTauri() || pending.current) return;
        event.preventDefault();
        pending.current = true;
        let moved: boolean | undefined;
        try {
          moved = await beginFloatingDrag({ x: event.screenX, y: event.screenY });
        }
        catch { setError("Could not move StashDock. Please try again."); }
        finally { pending.current = false; }
        if (moved) onMoved?.();
        else if (moved === false) await activate();
      }}
      onClick={event => { if (!isTauri() || event.detail === 0) void activate(); }}>
      <FolderArtwork />
    </button>
    <button type="button" className={styles.close} data-no-drag aria-label={t('Hide StashDock')}
      onPointerDown={event => event.stopPropagation()}
      onClick={() => { void hideStashDock().catch(() => setError("Could not hide StashDock. Please try again.")); }}>
      <FolderCloseArtwork className={styles.artwork} />
    </button>
    </div>
    {error && <span className="sr-only" role="alert">{t(error)}</span>}
  </main>;
}
