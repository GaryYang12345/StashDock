import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FloatingFolder } from "./FloatingFolder";
import { desktopSurface, switchDesktopSurface, type DesktopWindowStatus } from "../lib/desktopWindows";
import { Alert } from "./arc/alert/alert";
import { useI18n } from '../features/settings/locale';
import { useDesktopPreferences } from '../features/settings/preferences';

type Props = { renderLibrary: (collapse: () => void, active: boolean, maximized: boolean, floatingWindow: boolean) => React.ReactNode };
/** Native windows persist; switching does not remount the shelf. */
export function DesktopWindows({ renderLibrary }: Props) {
  const { t } = useI18n();
  const { info } = useDesktopPreferences();
  const floatingWindow = info?.preferences.floatingWindow ?? true;
  const surface = desktopSurface();
  const [status, setStatus] = useState<DesktopWindowStatus>({ visible: "panel", requested: "panel", maximized: false });
  const [error, setError] = useState("");
  useEffect(() => {
    let stopped = false;
    const cleanups: (() => void)[] = [];
    const update = (current: DesktopWindowStatus) => {
      if (stopped) return;
      setStatus(current);
    };
    void (async () => {
      const register = async <T,>(name: string, callback: (payload: T) => void) => {
        const cleanup = await listen<T>(name, event => { if (!stopped) callback(event.payload); });
        if (stopped) cleanup(); else cleanups.push(cleanup);
      };
      await register<DesktopWindowStatus>('desktop-window-state', update);
      const current = await invoke<DesktopWindowStatus>("desktop_window_ready");
      update(current);
    })().catch(() => { if (!stopped) setError("Could not initialize the window. Close and reopen StashDock."); });
    return () => { stopped = true; cleanups.forEach(cleanup => cleanup()); };
  }, [surface]);
  const switchTo = async (next: "panel" | "folder") => {
    try { setError(""); setStatus(await switchDesktopSurface(next)); return true; }
    catch { setError("Could not switch windows. Please try again."); return false; }
  };
  if (surface === "folder") return <div className="desktop-folder-content"><FloatingFolder onOpen={() => switchTo("panel")} /></div>;
  return <div className="desktop-panel">
    {error && <div className="desktop-window-error"><Alert tone="danger" title={t(error)} onDismiss={() => setError("")} /></div>}
    {renderLibrary(() => { void switchTo("folder"); }, status.visible === "panel", status.maximized, floatingWindow)}
  </div>;
}
