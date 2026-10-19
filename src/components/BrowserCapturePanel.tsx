import { useI18n } from '../features/settings/locale';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Globe, Plus } from 'lucide-react';
import { Button } from './arc/button/button';
import { Input } from './arc/input/input';
import { Alert } from './arc/alert/alert';
import { ScrollArea } from './arc/scroll-area/scroll-area';
import { FluidDialog } from './FluidDialog';
import { captureSites, customCapturePlatform, type CapturePlatform, type CaptureSiteId } from '../lib/captureSites';
import type { LinkImportService } from '../lib/linkImport';
import { PlatformIcon } from './PlatformIcon';
import { SiteFavicon } from './SiteIdentity';
import styles from './BrowserCapturePanel.module.css';

export function BrowserCapturePanel({ onBack, services }: { onBack: () => void; services: LinkImportService }) {
  const { t } = useI18n();
  const [custom, setCustom] = useState<CapturePlatform[]>([]);
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [url, setUrl] = useState('');
  const [inputError, setInputError] = useState('');
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let active = true;
    setLoading(true);
    Promise.resolve().then(() => services.listCapturePlatforms?.() || []).then(values => { if (active) setCustom(values); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Saved platforms could not be read.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; alive.current = false; };
  }, [services]);
  useEffect(() => {
    let active = true;
    if (custom.length && services.icons) void (async () => {
      // Both adapters accept at most 12 URLs per guarded favicon request.
      for (let offset = 0; active && offset < custom.length; offset += 12) {
        try { const values = await services.icons!(custom.slice(offset, offset + 12).map(platform => platform.url)); if (active) setIcons(current => ({ ...current, ...values })); }
        catch { /* A missing favicon must not block navigation or other batches. */ }
      }
    })();
    return () => { active = false; };
  }, [custom, services]);
  async function open(platform: CapturePlatform) {
    if (pending.current || !services.openCaptureSite) return;
    pending.current = true; setOpening(platform.id); setError('');
    try { await services.openCaptureSite(platform.id); }
    catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'Your browser could not be opened. Retry.'); }
    finally { pending.current = false; if (alive.current) setOpening(null); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current || !services.saveCapturePlatform) return;
    let value: CapturePlatform;
    try { value = customCapturePlatform(url); } catch (reason) { setInputError((reason as Error).message); return; }
    pending.current = true; setSaving(true); setInputError('');
    try { const values = await services.saveCapturePlatform(value.url); if (alive.current) { setCustom(values); setAdding(false); setUrl(''); } }
    catch (reason) { if (alive.current) setInputError(reason instanceof Error ? reason.message : 'This platform could not be saved. Retry.'); }
    finally { pending.current = false; if (alive.current) setSaving(false); }
  }
  return <section className={styles.panel} aria-label={t("Save from platforms")}>
    <div className={styles.heading}><Button type="button" variant="ghost" size="sm" aria-label={t("Back to Link")} onClick={onBack} disabled={Boolean(opening) || saving}><ArrowLeft size={16} strokeWidth={1.75} /></Button><h3>{t("Platforms")}</h3>
      {services.saveCapturePlatform && <Button type="button" variant="ghost" size="sm" disabled={loading || Boolean(opening)} onClick={() => { setInputError(''); setAdding(true); }}><Plus size={16} strokeWidth={1.75} />{t("Add platform")}</Button>}</div>
    <p className={styles.instructions}>{t("Open a post, then click the StashDock extension to review and save it.")}</p>
    <ScrollArea maxHeight="390px" label={t("Platforms")} fade={0}><ul className={styles.list}>
      {[...captureSites, ...custom].map(platform => <li className={styles.row} key={platform.id}>
        {platform.id.startsWith('custom:') ? <span className={styles.customIcon}>{icons[platform.url] ? <SiteFavicon candidates={[icons[platform.url]]} label={platform.name} remoteFallback={false} /> : <Globe size={20} strokeWidth={1.75} />}</span> : <PlatformIcon site={platform.id as CaptureSiteId} />}
        <span className={styles.name} data-tooltip={platform.name}>{platform.name}</span>
        <Button type="button" variant="secondary" size="sm" loading={opening === platform.id} disabled={Boolean(opening) && opening !== platform.id} aria-label={t('Open {name}', { name: platform.name })} onClick={() => open(platform)}>{t("Open")}<ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
      </li>)}
    </ul></ScrollArea>
    <Alert tone="danger" title={t("Platforms could not be loaded")} open={Boolean(error)}>{t(error)}</Alert>
    <FluidDialog open={adding} title={t("Add platform")} onClose={() => { if (!saving) setAdding(false); }} busy={saving}>
      <form className={styles.form} onSubmit={save}><Input label={t("Website link")} type="text" autoFocus placeholder="https://example.com" value={url} onChange={event => { setUrl(event.target.value); setInputError(''); }} error={t(inputError)} maxLength={2048} disabled={saving} />
        <div className={styles.actions}><Button type="submit" variant="primary" loading={saving} disabled={!url.trim()}>{t("Save platform")}</Button></div></form>
    </FluidDialog>
  </section>;
}
