import { Trash2, X } from 'lucide-react';
import { Button } from './arc/button/button';
import { useI18n } from '../features/settings/locale';

/** Shared placement and treatment for Desktop and the AI-hosted selection bar. */
export function SelectionManagementActions({ onDelete, onClear, disabled = false }: {
  onDelete?: () => void; onClear: () => void; disabled?: boolean;
}) {
  const { t } = useI18n();
  return <>
    {onDelete && <Button type="button" variant="ghost" size="sm" disabled={disabled} aria-label={t('Delete selected references')} data-tooltip={t('Delete selected references')} onClick={onDelete}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" /></Button>}
    <Button type="button" variant="ghost" size="sm" disabled={disabled} aria-label={t('Clear selection')} onClick={onClear}><X size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
  </>;
}
