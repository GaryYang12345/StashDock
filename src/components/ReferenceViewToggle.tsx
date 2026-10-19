import { useI18n } from '../features/settings/locale';
import { LayoutGrid, List } from 'lucide-react';
import SegmentedControl from './arc/segmented-control/segmented-control';

const views = [
  { value: 'grid', label: 'Grid', accessory: <LayoutGrid size={16} strokeWidth={1.75} aria-hidden="true" /> },
  { value: 'list', label: 'List', accessory: <List size={16} strokeWidth={1.75} aria-hidden="true" /> },
];
export function ReferenceViewToggle({ value, onChange }: { value: 'grid' | 'list'; onChange: (value: 'grid' | 'list') => void }) {
  const { t } = useI18n();
  return <SegmentedControl label={t("Reference view")} value={value} onValueChange={value => onChange(value as 'grid' | 'list')} options={views.map(option => ({ ...option, label: t(option.label) }))} />;
}
