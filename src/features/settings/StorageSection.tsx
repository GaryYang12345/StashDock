import { useEffect, useRef, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from '../../components/arc/button/button';
import { Alert } from '../../components/arc/alert/alert';
import { Skeleton } from '../../components/arc/skeleton/skeleton';
import { FluidDialog } from '../../components/FluidDialog';
import { SettingsRow, formatStorageSize } from './SettingsParts';
import { SettingHelp } from './SettingHelp';
import { useI18n } from './locale';
import styles from './SettingsView.module.css';

export type StorageInfo = { path: string; bytes: number; references: number };
export type StorageDestination = { path: string; token?: string };
export type StorageServices = {
  read: () => Promise<StorageInfo>;
  open: () => Promise<unknown>;
  choose: () => Promise<StorageDestination | null>;
  move: (destination: StorageDestination) => Promise<unknown>;
};
export function StorageSection({ services, onBusyChange, onMoved, disabled = false }: { services: StorageServices; onBusyChange: (busy: boolean) => void; onMoved?: () => void; disabled?: boolean }) {
  const { t, language } = useI18n();
  const [storage, setStorage] = useState<StorageInfo | null>(null), [reading, setReading] = useState(true);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [moving, setMoving] = useState(false);
  const [destination, setDestination] = useState<StorageDestination | null>(null);
  const alive = useRef(false), generation = useRef(0), flight = useRef(false), trigger = useRef<HTMLButtonElement>(null);
  async function read() {
    const request = ++generation.current; setReading(true); setError('');
    try {
      const value = await services.read();
      if (!value || typeof value.path !== 'string' || !Number.isFinite(value.bytes) || value.bytes < 0 || !Number.isSafeInteger(value.references) || value.references < 0) throw Error('Storage details could not be read. Retry.');
      if (alive.current && generation.current === request) setStorage(value);
    } catch (reason) { if (alive.current && generation.current === request) setError(String(reason)); }
    finally { if (alive.current && generation.current === request) setReading(false); }
  }
  useEffect(() => { alive.current = true; void read(); return () => { alive.current = false; ++generation.current; }; }, [services]);
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  async function run(task: () => Promise<unknown>, isMove = false) {
    if (flight.current || disabled) return;
    flight.current = true; setBusy(true); setMoving(isMove); setError('');
    try { await task(); }
    catch (reason) { if (alive.current) setError(String(reason)); }
    finally { flight.current = false; if (alive.current) { setBusy(false); setMoving(false); } }
  }
  return <><section className={styles.section} aria-labelledby="settings-storage"><h2 id="settings-storage">{t('Storage')}</h2><div className={styles.group}>
    <SettingsRow title={t('Used space')} description={storage ? t('{count} references', { count: storage.references }) : undefined}>{reading ? <Skeleton label={t('Used space')} lines={1} /> : storage && <span className={styles.number}>{formatStorageSize(storage.bytes, language)}</span>}</SettingsRow>
    <div className={styles.location}><div className={styles.locationLabel}><span className={styles.label}>{t('Storage location')}</span><SettingHelp label={t('About storage location')}>{t('Shared by StashDock Desktop and AI plugins on this device.')}</SettingHelp></div>{reading ? <Skeleton label={t('Storage location')} lines={1} /> : storage && <p className={styles.path}>{storage.path}</p>}<div className={styles.actions}><Button variant="secondary" size="sm" disabled={!storage || busy} onClick={() => void run(services.open)}><FolderOpen size={16} strokeWidth={1.75} aria-hidden="true" />{t('Open folder')}</Button><Button ref={trigger} variant="ghost" size="sm" disabled={!storage || busy} onClick={() => void run(async () => { const value = await services.choose(); if (alive.current && value) setDestination(value); })}>{t('Change location')}</Button></div></div>
  </div><Alert tone="danger" title={t('Storage could not be updated')} open={Boolean(error) && !destination}><span>{t(error.replace(/^Error: /, ''))}</span><Button variant="secondary" size="sm" disabled={busy} onClick={() => void read()}>{t('Retry')}</Button></Alert></section>
  <FluidDialog open={Boolean(destination)} returnFocus={trigger} onClose={() => { if (!busy) { setDestination(null); setError(''); } }} busy={busy} title={t(moving ? 'Moving your library…' : 'Change storage location?')} description={t('Move references and files to this folder.')}>
    <p className={styles.path}>{destination?.path}</p><Alert tone="danger" title={t('Storage could not be updated')} open={Boolean(error)}>{t(error.replace(/^Error: /, ''))}</Alert><div className={styles.actions}><Button variant="secondary" disabled={busy} onClick={() => { setDestination(null); setError(''); }}>{t('Cancel')}</Button><Button variant="primary" loading={moving} disabled={busy && !moving} onClick={() => { if (destination) void run(async () => { await services.move(destination); if (alive.current) { setDestination(null); onMoved?.(); await read(); } }, true); }}>{t('Move library')}</Button></div>
  </FluidDialog></>;
}
