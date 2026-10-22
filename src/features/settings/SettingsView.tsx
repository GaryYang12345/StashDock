import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Button } from '../../components/arc/button/button';
import { Alert } from '../../components/arc/alert/alert';
import { Skeleton } from '../../components/arc/skeleton/skeleton';
import { SettingsFrame, SettingsRow as Row, SettingsChoice as Choice, AppearanceFields } from './SettingsParts';
import { StorageSection, type StorageInfo, type StorageServices } from './StorageSection';
import { IntegrationIcon } from './IntegrationIcon';
import { openExternalUrl } from '../../lib/external';
import { useDesktopPreferences } from './preferences';
import { useI18n } from './locale';
import styles from './SettingsView.module.css';
import { IntegrationSections } from './IntegrationSections';
import type { IntegrationInfo } from './integrations';
import { GitHubMark } from './GitHubMark';
import { UpdateDialog, versionLabel } from './UpdateDialog';

export default function SettingsView({ onClose, onBusyChange }: { onClose: () => void; onBusyChange: (busy: boolean) => void }) {
  const { t } = useI18n();
  const { info, loading, pending, error, reload, save, setStartup } = useDesktopPreferences();
  const loadIntegrations = useCallback(() => invoke<IntegrationInfo>('get_integration_status'), []);
  const [operationError, setOperationError] = useState('');
  const [moving, setMoving] = useState(false);
  const [restartRequired, setRestartRequired] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const alive = useRef(true), operation = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onBusyChange(moving || restartRequired); return () => onBusyChange(false); }, [moving, restartRequired, onBusyChange]);
  const storageServices = useMemo<StorageServices>(() => ({
    read: () => invoke<StorageInfo>('get_storage_info'),
    open: () => invoke('open_storage_folder'),
    choose: async () => { const path = await open({ directory: true, multiple: false, title: t('Choose an empty folder') }); return typeof path === 'string' ? { path } : null; },
    move: async ({ path }) => {
      await invoke('move_library', { path });
      setRestartRequired(true);
      try { await invoke('restart_desktop'); } catch (reason) { if (alive.current) setOperationError(String(reason)); }
    },
  }), [t]);
  const disabled = loading || pending || !info || moving || restartRequired;
  function run(task: () => Promise<unknown>) {
    if (operation.current) return;
    operation.current = true; setOperationError('');
    void task().catch(reason => { if (alive.current) setOperationError(String(reason)); }).finally(() => { operation.current = false; });
  }
  const preferences = info?.preferences;
  return <SettingsFrame onClose={onClose} busy={moving || restartRequired} loading={loading}>
        {loading ? <div className={styles.loading}><Skeleton label={t('Settings')} lines={4} /><Skeleton label={t('Storage')} lines={3} /></div> : !info ? <Alert tone="danger" title={t('Settings could not be loaded')}><p>{t(error)}</p><Button variant="secondary" onClick={() => void reload()}>{t('Retry')}</Button></Alert> : <>
        <section className={styles.section} aria-labelledby="settings-general"><h2 id="settings-general">{t('General')}</h2><div className={styles.group}>
          <AppearanceFields preferences={preferences!} disabled={disabled} onSave={save} />
          <Row title={t('Launch at login')}><Choice label={t('Launch at login')} value={info.launchAtLogin ? 'on' : 'off'} disabled={disabled || !isTauri()} options={[{ value: 'off', label: t('Off') }, { value: 'on', label: t('On') }]} onChange={value => { void setStartup(value === 'on').catch(() => {}); }} /></Row>
          <Row title={t('Floating window')} description={t(preferences!.floatingWindow ? 'Minimize to a floating folder.' : 'Minimize to the taskbar. Close to quit.')}><Choice label={t('Floating window')} value={preferences!.floatingWindow ? 'on' : 'off'} disabled={disabled} options={[{ value: 'off', label: t('Off') }, { value: 'on', label: t('On') }]} onChange={value => { void save({ floatingWindow: value === 'on' }).catch(() => {}); }} /></Row>
          <Row title={t('Shortcut')} description={t('Show or hide StashDock')}><Choice label={t('Shortcut')} value={preferences!.shortcut} disabled={disabled} options={['Ctrl+Shift+Space', 'Ctrl+Alt+Space', 'Alt+Shift+Space', ''].map(value => ({ value, label: value || t('None') }))} onChange={shortcut => { void save({ shortcut }).catch(() => {}); }} /></Row>
        </div><Alert tone="danger" title={t('Settings could not be saved')} open={Boolean(error)}>{t(error)}</Alert></section>
        <StorageSection services={storageServices} onBusyChange={setMoving} disabled={restartRequired} />
        <IntegrationSections host="desktop" load={loadIntegrations} openLink={openExternalUrl} openApp={id => invoke('open_integration', { id })} disabled={moving || restartRequired} />
        <section className={styles.section} aria-labelledby="settings-about"><h2 id="settings-about">{t('About')}</h2><div className={styles.group}>
          <Row title="StashDock Desktop" meta={versionLabel(info.version)} icon={<IntegrationIcon id="desktop" />}><Button variant="secondary" size="sm" disabled={moving} onClick={() => setCheckingUpdates(true)}><RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />{t('Check for updates')}</Button></Row>
          {info.githubUrl && <Row title="GitHub" icon={<GitHubMark />}><Button variant="ghost" size="sm" onClick={() => run(() => openExternalUrl(info.githubUrl!))}>{t('Open')}<ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" /></Button></Row>}
        </div></section>
        <UpdateDialog open={checkingUpdates} version={info.version} onClose={() => setCheckingUpdates(false)} openLink={openExternalUrl} />
        </>}
        {restartRequired && operationError ? <Alert tone="info" title={t('Storage location updated')}><Button variant="secondary" onClick={() => run(() => invoke('restart_desktop'))}>{t('Restart StashDock Desktop')}</Button></Alert> : <Alert tone="danger" title={t('Try again.')} open={Boolean(operationError)}>{t(operationError)}</Alert>}
    </SettingsFrame>;
}
