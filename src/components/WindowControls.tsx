import { useI18n } from '../features/settings/locale';
import { Minus, X, Square, Copy } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import styles from "./WindowControls.module.css";
import { Button } from './arc/button/button';

type Props = { maximized?: boolean; nativeResize?: boolean; floatingWindow?: boolean; disabled?: boolean; onCollapse?: () => void; onClose?: () => void };

export function WindowControls({ maximized = false, nativeResize = false, floatingWindow = true, disabled = false, onCollapse, onClose }: Props) {
  const { t } = useI18n();
  const minimizeLabel = t(floatingWindow ? 'Minimize to folder' : 'Minimize window');
  return <div className={styles.controls} data-no-drag onPointerDown={event => event.stopPropagation()}>
    <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onCollapse} className={styles.control} aria-label={minimizeLabel} data-tooltip={minimizeLabel}><Minus size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
    {nativeResize && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => { void getCurrentWindow().toggleMaximize().catch(console.warn); }} className={styles.control} aria-label={maximized ? t("Restore window") : t("Maximize window")} data-tooltip={maximized ? t("Restore window") : t("Maximize window")}>{maximized ? <Copy size={14} strokeWidth={1.75} aria-hidden="true" /> : <Square size={14} strokeWidth={1.75} aria-hidden="true" />}</Button>}
    <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onClose} className={styles.control} aria-label={t(floatingWindow ? 'Hide StashDock' : 'Close StashDock')}><X size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
  </div>;
}
