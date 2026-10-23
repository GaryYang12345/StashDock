import { useI18n } from '../features/settings/locale';
import { Search, Bookmark, Plus, FileText, Globe, Star, Tag } from "lucide-react";
import { EmptyState as ArcEmptyState } from "./arc/empty-state/empty-state";
import { Button } from "./arc/button/button";

/** Where the shelf is looking: a collection, or a tag. */
export type EmptyScope = "all" | "recent" | "web" | "files" | "favorites" | "tag";

/**
 * One empty state per real reason: a search with no results offers to clear
 * the search; an empty collection says what belongs there and how to add it;
 * an empty library offers the import.
 */
export function EmptyState({ query, scope, onAdd, onClearSearch, onShowAll }: {
  query: string;
  scope: EmptyScope;
  onAdd: () => void;
  onClearSearch: () => void;
  onShowAll: () => void;
}) {
  const { t } = useI18n();
  const importAction = <Button variant="secondary" onClick={onAdd}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />{t("Import references")}</Button>;
  const content = query.trim()
    ? { icon: <Search size={24} strokeWidth={1.75} />, title: t("No matching references"), description: t("Try different keywords."),
        action: <Button variant="secondary" onClick={onClearSearch}>{t("Clear search")}</Button> }
    : scope === "files"
      ? { icon: <FileText size={24} strokeWidth={1.75} />, title: t("No files yet"), description: t("Import PDFs, documents and other local files to use as AI context."), action: importAction }
      : scope === "web"
        ? { icon: <Globe size={24} strokeWidth={1.75} />, title: t("No web pages yet"), description: t("Save pages from your browser, or import links and bookmarks."), action: importAction }
        : scope === "favorites"
          ? { icon: <Star size={24} strokeWidth={1.75} />, title: t("No favorites yet"), description: t("Star the references you use often to find them here."), action: undefined }
          : scope === "tag"
            ? { icon: <Tag size={24} strokeWidth={1.75} />, title: t("No references with this tag"), description: t("Add this tag to references to group them here."),
                action: <Button variant="secondary" onClick={onShowAll}>{t("Show all references")}</Button> }
            : { icon: <Bookmark size={24} strokeWidth={1.75} />, title: t("Your shelf is empty"), description: t("Import browser bookmarks, links, notes, or local files."), action: importAction };
  return <ArcEmptyState label={t("Empty references")} icon={content.icon} title={content.title} description={content.description} action={content.action} />;
}
