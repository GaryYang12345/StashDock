import { useI18n } from '../features/settings/locale';
import { ExternalLink, Check, Circle, Star, Trash2 } from "lucide-react";
import { referenceEditActions, ReferenceMenuIcon } from './referenceActions';
import { DesktopMenu } from './DesktopMenu';
import { startReferenceDrag, endReferenceDrag } from "../lib/reference-drag";
import { memo, useState, type ReactNode, type Ref, type HTMLAttributes } from "react";
import type { StashItem } from "../types";
import { Button } from "./arc/button/button";
import { CopyForAI } from "./CopyForAI";
import { SiteIdentity } from "./SiteIdentity";
import { Skeleton } from "./arc/skeleton/skeleton";
import styles from "./StashCard.module.css";
import { ReferenceDefaultCover } from './ReferenceVisual';
import { referenceOpenTarget } from '../lib/referenceOpen';

// Desktop serves covers from its library protocol with CORS, so a card image can
// still be painted into the native drag preview canvas without tainting it.
const libraryPreviewUrl = (value: string) => /^(?:http:\/\/stashdock-preview\.localhost\/|stashdock-preview:\/\/)/.test(value);

export function PreviewArtwork({ item }: { item: StashItem }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const loading = !item.preview && (item.previewStatus === "queued" || item.previewStatus === "working");
  return <div className={styles.preview} aria-busy={loading}>
    {loading ? <div className={styles.previewLoading}>
      <Skeleton className={styles.previewDocument} label={t("Loading preview")} lines={5} />
      <Skeleton className={styles.previewCompact} label={t("Loading preview")} lines={3} />
    </div> :
    item.preview && !failed ? <img src={item.preview} crossOrigin={libraryPreviewUrl(item.preview) ? 'anonymous' : undefined} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} />
      : <ReferenceDefaultCover item={item} />}
  </div>;
}

type StashCardProps = {
  item: StashItem;
  selected: boolean;
  copied: boolean;
  dragItems: StashItem[];
  view: "grid" | "list";
  onToggle: (id: string) => void;
  onFavorite: (id: string) => void;
  onDelete: (item: StashItem) => void;
  onOpen: (item: StashItem) => void;
  onCopy: (item: StashItem) => void | Promise<void>;
  onEdit?: (item: StashItem) => void;
  onEditContent?: (item: StashItem) => void;
};

type ReferenceCardViewProps = Omit<StashCardProps, 'copied' | 'dragItems' | 'onCopy'> & {
  action: ReactNode;
  selectable?: boolean;
  status?: string;
  selectionDisabled?: boolean;
  busy?: boolean;
  favoriteLoading?: boolean;
  cardRef?: Ref<HTMLElement>;
  articleProps?: HTMLAttributes<HTMLElement>;
  className?: string;
};

/** One card presentation for both hosts; adapters own only platform actions. */
export function ReferenceCardView({ item, selected, view, onToggle, onFavorite, onDelete, onOpen, onEdit, onEditContent, action, selectable = true, selectionDisabled = false, busy = false, favoriteLoading = false, cardRef, articleProps, className = '', status }: ReferenceCardViewProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const select = <div className={styles.selection} data-visible={selected || undefined}>
    <Button type="button" variant="secondary" size="sm" className={styles.iconButton} aria-pressed={selected}
      aria-label={t(selected ? 'Remove {title} from context' : 'Add {title} to context', { title: item.title })}
      data-tooltip={t("Select")} disabled={selectionDisabled} onClick={() => onToggle(item.id)}>
      {selected ? <Check size={16} strokeWidth={1.75} aria-hidden="true" /> : <Circle size={16} strokeWidth={1.75} aria-hidden="true" />}
    </Button>
  </div>;
  const controls = <div className={styles.controls}>
    <Button type="button" variant="secondary" size="sm" className={`${styles.iconButton} ${item.favorite ? styles.favorite : ""}`} aria-pressed={Boolean(item.favorite)}
      aria-label={t(item.favorite ? 'Remove {title} from favorites' : 'Add {title} to favorites', { title: item.title })}
      loading={favoriteLoading} disabled={busy && !favoriteLoading} data-tooltip={item.favorite ? t("Remove from favorites") : t("Add to favorites")} onClick={() => onFavorite(item.id)}>
      <Star size={16} fill={item.favorite ? "currentColor" : "none"} strokeWidth={1.75} aria-hidden="true" />
    </Button>
    <Button type="button" variant="secondary" size="sm" className={styles.iconButton} aria-label={t('Delete {title}', { title: item.title })} data-tooltip={t("Delete reference")} disabled={busy} onClick={() => onDelete(item)}>
      <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
    </Button>
  </div>;
  const target = referenceOpenTarget(item);
  const source = <div className={styles.site}><SiteIdentity item={item} />{target && <Button type="button" variant="ghost" size="sm" aria-label={t('Open {title}', { title: item.title })} data-tooltip={t(target === 'link' ? 'Open link' : 'Open file')} onClick={() => onOpen(item)}>
    <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
  </Button>}</div>;

  // Domain-specific shelf layout; Arc controls stay unmodified. The generic
  // Card's quick-look/title/footer structure cannot express the image toolbar.
  const menuActions = referenceEditActions(() => onEdit?.(item), onEditContent ? () => onEditContent(item) : undefined);
  const card = <article {...articleProps} ref={cardRef} data-arc-ui data-reference-id={item.id} data-menu-open={menuOpen || undefined} data-selected={selected || undefined} className={`${view === "grid" ? styles.card : styles.row} ${styles.desktop} ${className}`}
    aria-label={item.title}>
    <div className={styles.artwork}><PreviewArtwork key={item.preview} item={item} />{selectable && select}{controls}
    </div>
    <div className={styles.details}><div className={styles.titleRow}><h3 data-tooltip={item.title}>{item.title}</h3>{onEdit && <div className={styles.moreAction} data-no-drag>
      <DesktopMenu onOpenChange={setMenuOpen} label={t('Actions for {title}', { title: item.title })} actions={menuActions}><Button data-card-menu variant="ghost" size="sm" className={styles.iconButton} disabled={busy} aria-label={t('Edit {title}', { title: item.title })}><ReferenceMenuIcon /></Button></DesktopMenu>
    </div>}</div><div className={styles.footer}>{source}{action}</div></div>
    <span className="sr-only" role="status">{status ?? ""}</span>
  </article>;
  return card;
}

export const StashCard = memo(function StashCard({ copied, dragItems, onCopy, ...props }: StashCardProps) {
  const { t } = useI18n();
  const {item, selected} = props;
  const startDrag = (event: React.DragEvent<HTMLElement>) => {
    const items = selected && dragItems.length ? dragItems : [item];
    startReferenceDrag(event, items);
  };
  return <ReferenceCardView {...props}
    articleProps={{ draggable: true, onDragStartCapture: startDrag, onDragEnd: endReferenceDrag }}
    action={<CopyForAI className={styles.copyAction} copied={copied} responsiveLabel onCopy={() => onCopy(item)} label={t('Copy {title} for AI', { title: item.title })} />}
    status={copied ? t('{title} copied', { title: item.title }) : ''} />;
});
