import { useI18n } from '../features/settings/locale';
import { useEffect, useState } from 'react';
import { FluidDialog } from './FluidDialog';
import { Input } from './arc/input/input';
import { Button } from './arc/button/button';
import { DestructiveButton } from './DestructiveButton';
import { Alert } from './arc/alert/alert';
import styles from './ReferenceEditor.module.css';

export type TagOperation = { name: string; action: 'rename' | 'remove' };
export function TagEditor({ operation, onClose, onSave, returnFocus }: { operation: TagOperation | null; onClose: () => void; onSave: (name: string, replacement: string | null) => Promise<void>; returnFocus?: React.RefObject<HTMLElement | null> }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (operation) { setValue(operation.name); setError(''); setSaved(false); } }, [operation]);
  const remove = operation?.action === 'remove';
  const SubmitButton = remove ? DestructiveButton : Button;
  return <FluidDialog open={Boolean(operation)} onClose={onClose} busy={busy} returnFocus={returnFocus} title={remove ? t("Remove tag?") : t("Rename tag")} description={operation ? t(remove ? 'Remove “{name}” across all references. References stay saved.' : 'Rename “{name}” across all references. References stay saved.', { name: operation.name }) : undefined}>
    <form className={styles.form} onSubmit={event => {
      event.preventDefault(); if (!operation || busy) return;
      setBusy(true); setError(''); setSaved(false);
      void onSave(operation.name, remove ? null : value.trim()).then(() => { setSaved(true); onClose(); }).catch(error => setError(error instanceof Error ? error.message : 'Tags could not be saved. Retry.')).finally(() => setBusy(false));
    }}>
      {!remove && <Input label={t("Tag name")} value={value} onChange={event => { setValue(event.target.value); setSaved(false); }} required maxLength={48} disabled={busy} />}
      <Alert tone="danger" title={t("Tag could not be changed")} open={Boolean(error)}>{t(error)}</Alert>
      <div className={styles.actions}><Button variant="secondary" type="button" disabled={busy} onClick={onClose}>{saved ? t("Close editor") : t("Cancel")}</Button><SubmitButton type="submit" loading={busy} disabled={saved}>{saved ? remove ? t("Removed") : t("Saved") : remove ? t("Remove tag") : t("Save name")}</SubmitButton></div>
      <span className="sr-only" role="status">{saved ? t("Tag updated") : ''}</span>
    </form>
  </FluidDialog>;
}
