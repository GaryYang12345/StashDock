import { useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { FolderArtwork } from "./FolderArtwork";
import { X } from "lucide-react";
import { beginFloatingDrag, hideStashDock } from "../lib/desktopWindows";
import styles from "./FloatingFolder.module.css";
import { useI18n } from '../features/settings/locale';

type Props = { onOpen: () => boolean | void | Promise<boolean | void>; onMoved?: () => void };

export function FloatingFolder({ onOpen, onMoved }: Props) {
  const { t } = useI18n();
  const pending = useRef(false);
  const [error, setError] = useState("");
  const activate = async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      setError("");
      if (await onOpen() === false) throw new Error("Window transition failed");
    } catch { setError("Could not open StashDock. Please try again."); }
    finally { pending.current = false; }
  };
  return <main className="floating-folder-root">
    <div className="floating-folder-surface">
    <button type="button" className="floating-folder-button" aria-label={t('Open StashDock')}
      aria-description={t('Click to open. Drag to move.')}
      onPointerDown={async event => {
        if (event.button !== 0 || !isTauri() || pending.current) return;
        event.preventDefault();
        try {
          if (await beginFloatingDrag({ x: event.screenX, y: event.screenY })) onMoved?.();
          else await activate();
        }
        catch { setError("Could not move StashDock. Please try again."); }
      }}
      onClick={event => { if (!isTauri() || event.detail === 0) void activate(); }}>
      <FolderArtwork />
    </button>
    <button type="button" className={styles.close} data-no-drag aria-label={t('Hide StashDock')}
      onPointerDown={event => event.stopPropagation()}
      onClick={() => { void hideStashDock().catch(() => setError("Could not hide StashDock. Please try again.")); }}>
      <span className={styles.circle}><X size={10} strokeWidth={1.5} aria-hidden="true" /></span>
    </button>
    </div>
    {error && <span className="sr-only" role="alert">{t(error)}</span>}
  </main>;
}
