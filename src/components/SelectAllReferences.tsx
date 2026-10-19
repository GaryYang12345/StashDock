import { useI18n } from '../features/settings/locale';
import { Button } from './arc/button/button';

export function SelectAllReferences({ onSelectAll, allSelected, disabled = false, loading = false }: {
  onSelectAll: () => void; allSelected: boolean; disabled?: boolean; loading?: boolean;
}) {
  const { t } = useI18n();
  return <Button type="button" variant="ghost" size="sm" disabled={disabled || allSelected} loading={loading}
    data-tooltip={t("Select all matching references")} onClick={onSelectAll}>{t("Select all")}</Button>;
}
