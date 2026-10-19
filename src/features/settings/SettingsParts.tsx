import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft, Check, ChevronDown } from 'lucide-react';
import { Button } from '../../components/arc/button/button';
import { ScrollArea } from '../../components/arc/scroll-area/scroll-area';
import { DesktopMenu } from '../../components/DesktopMenu';
import { useI18n } from './locale';
import { ThemeChoice } from './ThemeChoice';
import styles from './SettingsView.module.css';

export type Appearance = { language: 'system' | 'en' | 'zh'; theme: 'system' | 'light' | 'dark' };
export function SettingsFrame({ children, onClose, busy = false, loading = false, title = 'Settings', backLabel = 'Back to library' }: { children: ReactNode; onClose: () => void; busy?: boolean; loading?: boolean; title?: string; backLabel?: string }) {
  const { t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className={styles.root} aria-labelledby="settings-heading" data-settings-view>
    <header className={styles.header}><div className={styles.headerInner}><h1 id="settings-heading" tabIndex={-1} ref={heading}>{t(title)}</h1><Button variant="ghost" size="sm" onClick={onClose} disabled={busy} aria-label={t(backLabel)}><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />{t('Back')}</Button></div></header>
    <ScrollArea className={styles.scroller} viewportClassName={styles.viewport} label={t('Settings')} fade={0}><div className={styles.page} aria-busy={loading || busy}>{children}</div></ScrollArea>
  </section>;
}
export function SettingsRow({ title, description, children, icon }: { title: string; description?: ReactNode; children: ReactNode; icon?: ReactNode }) {
  return <div className={styles.row}><div className={styles.brandIdentity}>{icon}<div className={styles.copy}><span className={styles.label}>{title}</span>{description && <div className={styles.description}>{description}</div>}</div></div><div className={styles.control}>{children}</div></div>;
}
export function SettingsChoice({ label, value, options, disabled, onChange }: { label: string; value: string; options: { value: string; label: string }[]; disabled?: boolean; onChange: (value: string) => void }) {
  return <DesktopMenu label={label} actions={options.map(option => ({ label: option.label, icon: option.value === value ? <Check size={16} strokeWidth={1.75} /> : <span />, onSelect: () => { if (!disabled) onChange(option.value); } }))}>
    <Button variant="secondary" size="sm" disabled={disabled} aria-label={`${label}: ${options.find(o => o.value === value)?.label ?? value}`}>{options.find(o => o.value === value)?.label ?? value}<ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
  </DesktopMenu>;
}
export function AppearanceFields({ preferences, disabled, host = false, onSave }: { preferences: Appearance; disabled?: boolean; host?: boolean; onSave: (patch: Partial<Appearance>) => Promise<unknown> }) {
  const { t } = useI18n();
  return <>
    <SettingsRow title={t('Language')}><SettingsChoice label={t('Language')} value={preferences.language} disabled={disabled} options={[{ value: 'system', label: t('Follow system') }, { value: 'en', label: 'English' }, { value: 'zh', label: '简体中文' }]} onChange={language => { void onSave({ language: language as Appearance['language'] }).catch(() => {}); }} /></SettingsRow>
    <SettingsRow title={t('Theme')}><ThemeChoice value={preferences.theme} disabled={disabled} host={host} onChange={theme => { void onSave({ theme }).catch(() => {}); }} /></SettingsRow>
  </>;
}
export function formatStorageSize(bytes: number, language: string) {
  const unit = bytes < 1024 ** 2 ? 1024 : bytes < 1024 ** 3 ? 1024 ** 2 : 1024 ** 3;
  return `${new Intl.NumberFormat(language === 'zh' ? 'zh-CN' : 'en', { maximumFractionDigits: 1 }).format(bytes / unit)} ${unit === 1024 ? 'KB' : unit === 1024 ** 2 ? 'MB' : 'GB'}`;
}
