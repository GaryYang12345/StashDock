import { CircleHelp } from 'lucide-react';
import styles from './SettingsView.module.css';

export function SettingHelp({ label, children }: { label: string; children: string }) {
  return <button type="button" className={styles.helpButton} aria-label={label} data-tooltip={children}><CircleHelp size={14} strokeWidth={1.75} aria-hidden="true" /></button>;
}
