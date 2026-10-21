import type { RefObject } from 'react';
import { FluidDialog } from './FluidDialog';
import { Button } from './arc/button/button';
import { Alert } from './arc/alert/alert';
import { DestructiveButton } from './DestructiveButton';
import { useI18n } from '../features/settings/locale';
import styles from './ReferenceDeleteDialog.module.css';

export type ReferenceDeletion = { ids: string[]; title?: string };
export function ReferenceDeleteDialog({ target, busy, error, onClose, onConfirm, returnFocus }: {
  target: ReferenceDeletion | null; busy: boolean; error: string;
  onClose: () => void; onConfirm: () => Promise<void>; returnFocus?: RefObject<HTMLElement | null>;
}) {
  const { t } = useI18n();
  const bulk = target?.title === undefined;
  return <FluidDialog open={Boolean(target)} busy={busy} onClose={onClose} returnFocus={returnFocus}
    title={t(bulk ? 'Delete selected references?' : 'Delete reference?')}
    description={target ? bulk ? t('Remove {count} selected references from StashDock?', { count: target.ids.length }) : t('Remove “{title}” from StashDock.', { title: target.title! }) : undefined}>
    <Alert tone="danger" title={t('Delete failed')} open={Boolean(error)}>{t(error)}</Alert>
    <div className={styles.actions}>
      <Button variant="secondary" disabled={busy} onClick={onClose}>{t(bulk ? 'Keep references' : 'Keep reference')}</Button>
      <DestructiveButton loading={busy} onClick={onConfirm}>{t(bulk ? 'Delete references' : 'Delete reference')}</DestructiveButton>
    </div>
  </FluidDialog>;
}
