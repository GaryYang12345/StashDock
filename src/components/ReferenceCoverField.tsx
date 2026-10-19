import { useI18n } from '../features/settings/locale';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from './arc/button/button';
import { Alert } from './arc/alert/alert';
import { COVER_ACCEPT, type PrepareReferenceCover, type ReferenceCover } from '../lib/referenceCover';
import styles from './ReferenceCoverField.module.css';

/** A quiet optional picker, not another upload panel competing with the form. */
export function ReferenceCoverField({ value, onChange, prepare, disabled = false, onPreparing, defaultPreview }: {
  value: ReferenceCover | null; onChange: (value: ReferenceCover | null) => void;
  prepare: PrepareReferenceCover; disabled?: boolean; onPreparing: (value: boolean) => void;
  defaultPreview?: string;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const flight = useRef(false), alive = useRef(true);
  const [reading, setReading] = useState(false), [error, setError] = useState('');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const choose = async (file: File) => {
    if (flight.current || disabled) return;
    flight.current = true; setReading(true); setError(''); onPreparing(true);
    try {
      const preview = await prepare(file);
      if (alive.current) onChange({ preview, name: file.name });
    } catch (reason) {
      if (alive.current) setError(typeof reason === 'string' ? reason : reason instanceof Error ? reason.message : 'The image could not be read. Choose another image.');
    } finally {
      flight.current = false;
      if (alive.current) { setReading(false); onPreparing(false); }
    }
  };
  return <div className={styles.field}>
    <div className={styles.row} aria-busy={reading || undefined}>
      <div className={styles.identity}><span className={styles.label}>{t("Cover")}</span>{(value?.preview || defaultPreview) && <img className={styles.thumbnail} src={value?.preview || defaultPreview} alt={value ? t("Selected cover") : t("Current cover")} />}<span className={styles.name} data-tooltip={value?.name}>{value ? value.name : t("Default")}</span></div>
      <div className={styles.actions}>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} loading={reading} aria-description={value?.name} onClick={() => input.current?.click()}><ImagePlus size={16} strokeWidth={1.75} aria-hidden="true" />{value ? t("Replace image") : t("Choose image")}</Button>
        {value && <Button type="button" variant="ghost" size="sm" disabled={disabled || reading} aria-label={t("Restore default cover")} data-tooltip={t("Restore default cover")} onClick={() => { onChange(null); setError(''); }}><X size={16} strokeWidth={1.75} aria-hidden="true" /></Button>}
      </div>
      <input ref={input} type="file" hidden accept={COVER_ACCEPT} disabled={disabled || reading} aria-label={t("Choose cover image")} onChange={event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (file) void choose(file);
      }} />
    </div>
    <span className="sr-only" role="status">{reading ? t("Preparing cover image") : value ? t("Custom cover selected. Save the reference to keep it.") : ''}</span>
    <Alert tone="danger" title={t("Cover could not be selected")} open={Boolean(error)}>{t(error)}</Alert>
  </div>;
}
