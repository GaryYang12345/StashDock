import { useI18n } from '../features/settings/locale';
import { useEffect, useRef, useState } from 'react';
import type { StashItem } from '../types';
import { FluidDialog } from './FluidDialog';
import { Input } from './arc/input/input';
import { Button } from './arc/button/button';
import { Alert } from './arc/alert/alert';
import { ReferenceTagsField } from './ReferenceTagsField';
import { ReferenceCoverField } from './ReferenceCoverField';
import type { PrepareReferenceCover, ReferenceCover, ReferenceCoverEdit } from '../lib/referenceCover';
import { cleanReferenceTags } from '../features/library/store';
import styles from './ReferenceEditor.module.css';

export function ReferenceEditor({ item, availableTags = [], onClose, onSave, returnFocus, prepareCover }: { item: StashItem | null; availableTags?: string[]; onClose: () => void; onSave: (id: string, title: string, tags: string[], cover?: ReferenceCoverEdit) => Promise<void>; returnFocus?: React.RefObject<HTMLElement | null>; prepareCover?: PrepareReferenceCover }) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [invalidTags, setInvalidTags] = useState(false);
  const [cover, setCover] = useState<ReferenceCover | null>(null);
  const [coverChanged, setCoverChanged] = useState(false), [coverReading, setCoverReading] = useState(false);
  const tagField = useRef<HTMLDivElement>(null);
  const currentTags = useRef<string[]>([]);
  useEffect(() => {
    setCoverReading(false); setCoverChanged(false);
    setCover(item?.preview && item.origin?.previewSource === 'custom' ? { preview: item.preview, name: t('Custom image') } : null);
    if (item) { setTitle(item.title); setTags(item.tags); currentTags.current = item.tags; setError(''); setSaved(false); setInvalidTags(false); }
  }, [item?.id]);
  const updateTags = (next: string[]) => {
    setSaved(false);
    const canonical = next.map(name => availableTags.find(tag => tag.toLowerCase() === name.trim().toLowerCase()) ?? name);
    try { const cleaned = cleanReferenceTags(canonical); currentTags.current = cleaned; setTags(cleaned); setInvalidTags(false); setError(''); }
    catch (error) { currentTags.current = canonical; setTags(canonical); setInvalidTags(true); setError(error instanceof Error ? error.message : 'Tags could not be added. Try again.'); }
  };
  return <FluidDialog open={Boolean(item)} onClose={onClose} busy={busy || coverReading} returnFocus={returnFocus} title={t("Edit card")}>
    <form className={styles.form} onSubmit={event => {
      event.preventDefault(); if (!item || busy || coverReading || invalidTags) return;
      setBusy(true); setError(''); setSaved(false);
      void Promise.resolve().then(() => {
        // Arc commits on blur. Read any remaining draft for keyboard form submission,
        // and retain synchronous tag changes when blur and submit share a gesture.
        const draft = tagField.current?.querySelector('input')?.value.trim() ?? '';
        const canonical = availableTags.find(tag => tag.toLowerCase() === draft.toLowerCase()) ?? draft;
        const next = cleanReferenceTags(canonical && !currentTags.current.some(tag => tag.toLowerCase() === canonical.toLowerCase()) ? [...currentTags.current, canonical] : currentTags.current);
        return onSave(item.id, title.trim(), next, coverChanged ? { preview: cover?.preview ?? null } : undefined).then(() => { currentTags.current = next; setTags(next); setSaved(true); onClose(); });
      }).catch(error => setError(error instanceof Error ? error.message : 'Changes could not be saved. Retry.')).finally(() => setBusy(false));
    }}>
      <Input label={t("Title")} value={title} onChange={event => { setTitle(event.target.value); setSaved(false); }} required maxLength={500} disabled={busy} />
      {item && prepareCover && <ReferenceCoverField key={item.id} value={cover} prepare={prepareCover} disabled={busy} onPreparing={setCoverReading} defaultPreview={item.origin?.previewSource !== 'custom' ? item.preview : undefined} onChange={value => { setCover(value); setCoverChanged(true); setSaved(false); }} />}
      <ReferenceTagsField value={tags} onValueChange={updateTags} availableTags={availableTags} fieldRef={tagField} busy={busy} onInput={() => setSaved(false)} />
      <Alert tone="danger" title={t("Changes could not be saved")} open={Boolean(error)}>{t(error)}</Alert>
      <div className={styles.actions}><Button variant="secondary" type="button" disabled={busy || coverReading} onClick={onClose}>{t("Close editor")}</Button><Button variant="primary" type="submit" loading={busy} disabled={saved || invalidTags || coverReading}>{saved ? t("Saved") : t("Save changes")}</Button></div>
      <span className="sr-only" role="status">{saved ? t("Reference saved") : ''}</span>
    </form>
  </FluidDialog>;
}
