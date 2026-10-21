import { useI18n } from '../features/settings/locale';
import { Search, Bookmark, Plus } from "lucide-react";
import { EmptyState as ArcEmptyState } from "./arc/empty-state/empty-state";
import { Button } from "./arc/button/button";
export function EmptyState({ hasQuery, onAdd, onClear }: { hasQuery: boolean; onAdd: () => void; onClear: () => void }) {
  const { t } = useI18n();
  return <ArcEmptyState label={t("Empty references")} icon={hasQuery ? <Search size={24} strokeWidth={1.75} /> : <Bookmark size={24} strokeWidth={1.75} />}
    title={hasQuery ? t("No matching references") : t("Your shelf is empty")}
    description={hasQuery ? t("Try a broader search or clear the filters.") : t("Import browser bookmarks, links, notes, or local files.")}
    action={<Button variant="secondary" onClick={hasQuery ? onClear : onAdd}>{!hasQuery && <Plus size={16} strokeWidth={1.75} aria-hidden="true" />}{hasQuery ? t("Clear filters") : t("Import references")}</Button>} />;
}
