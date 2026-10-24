import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../components/arc/button/button';
import { Alert } from '../../components/arc/alert/alert';
import { FluidDialog } from '../../components/FluidDialog';
import { IntegrationIcon } from './IntegrationIcon';
import { IntegrationGuide } from './IntegrationGuide';
import { SettingHelp } from './SettingHelp';
import { agents, browsers, integrationCatalog, integrationGuides, type IntegrationId, type IntegrationInfo } from './integrations';
import { useI18n } from './locale';
import settings from './SettingsView.module.css';
import styles from './IntegrationSections.module.css';
import { errorText } from '../../lib/errorText';

type Props = { host: 'desktop' | 'codex'; load: () => Promise<IntegrationInfo>; openLink: (url: string) => Promise<unknown>; openApp?: (id: IntegrationId) => Promise<unknown>; disabled?: boolean };
type Guide = { id: IntegrationId; kind: 'setup' | 'usage' };
export function IntegrationSections({ host, load, openLink, openApp, disabled }: Props) {
  const { t } = useI18n();
  const [info, setInfo] = useState<IntegrationInfo | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [guide, setGuide] = useState<Guide | null>(null);
  const request = useRef(0), returnFocus = useRef<HTMLElement | null>(null);
  async function refresh() {
    const generation = ++request.current; setLoading(true); setError('');
    try { const result = await load(); if (!result || !Array.isArray(result.items)) throw Error('Installation status could not be checked. Retry.'); if (request.current === generation) setInfo(result); }
    catch (reason) { if (request.current === generation) setError(errorText(reason)); }
    finally { if (request.current === generation) setLoading(false); }
  }
  useEffect(() => {
    void refresh();
    const onFocus = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { ++request.current; window.removeEventListener('focus', onFocus); };
  }, [load]);
  const groups = host === 'desktop' ? [{ title: 'Browser extensions', ids: browsers }, { title: 'AI plugins', ids: agents }]
    : [{ title: 'Browser extensions', ids: browsers }, { title: 'Desktop app', ids: ['desktop'] as IntegrationId[] }];
  const selected = guide ? integrationCatalog[guide.id] : null;
  const usage = guide?.kind === 'usage' ? integrationGuides[guide.id] : null;
  return <>
    {groups.map(({ title, ids }, group) => <section className={settings.section} key={title} aria-labelledby={`integrations-${group}`} data-integration-section={title}>
      <div className={styles.heading}><div className={styles.headingTitle}><h2 id={`integrations-${group}`}>{t(title)}</h2><SettingHelp label={t('About {section}', { section: t(title) })}>{t(integrationCatalog[ids[0]].purpose)}</SettingHelp></div>{group === 0 && <Button variant="ghost" size="sm" aria-label={t('Check installation status')} data-tooltip={t('Check installation status')} loading={loading} disabled={disabled} onClick={() => void refresh()}><RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" /></Button>}</div>
      <div className={settings.group}>{ids.map(id => {
        const entry = integrationCatalog[id], state = info?.items.find(item => item.id === id);
        return <div className={styles.row} key={id} data-integration-row={id}>
          <IntegrationIcon id={id} /><div className={styles.identity}><span className={settings.label}>{entry.name}</span></div>
          <div className={styles.actions}>{entry.ready && state?.detected && <span className={styles.status} data-detected>{t('Detected')}</span>}{!entry.ready && <span className={styles.status}>{t('Coming soon')}</span>}{entry.ready &&
            <Button variant="secondary" size="sm" loading={loading} disabled={disabled} aria-haspopup="dialog" aria-label={t(entry.ready && state?.detected ? 'View guide for {name}' : 'Set up {name}', { name: entry.name })} onClick={event => { returnFocus.current = event.currentTarget; setGuide({ id, kind: entry.ready && state?.detected ? 'usage' : 'setup' }); }}>{t(entry.ready && state?.detected ? 'View guide' : 'Set up')}</Button>
          }</div>
        </div>;
      })}</div>
      {group === 0 && error && <Alert tone="danger" title={t('Installation status could not be checked')}>{t(error)}<Button variant="secondary" size="sm" onClick={() => void refresh()}>{t('Retry')}</Button></Alert>}
    </section>)}
    <FluidDialog open={Boolean(guide)} returnFocus={returnFocus} onClose={() => setGuide(null)} title={usage ? t(usage.title) : selected ? t('Set up {name}', { name: selected.name }) : t('Installation guide')}>
      {guide && <IntegrationGuide key={`${guide.id}:${guide.kind}`} id={guide.id} kind={guide.kind} info={info} openApp={openApp} openLink={openLink} />}
    </FluidDialog>
  </>;
}
