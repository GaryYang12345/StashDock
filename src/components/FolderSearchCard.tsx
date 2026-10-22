import type { DragEvent } from 'react';
import { useI18n } from '../features/settings/locale';
import type { StashItem } from '../types';
import { CopyForAI } from './CopyForAI';
import { ReferenceMark } from './SiteIdentity';
import { PreviewArtwork } from './StashCard';
import cardStyles from './StashCard.module.css';
import styles from './FolderSearchCard.module.css';

/** The folder search card: the shelf card's cover and title row, flattened.
 *  No source line, menu, favorite or delete; Copy shows on hover as on the shelf. */
export function FolderSearchCard({ item, current, copied, onCopy, onActivate, onDragStart, onDragEnd }: {
  item: StashItem; current: boolean; copied: boolean; onCopy: () => void; onActivate: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void; onDragEnd: () => void;
}) {
  const { t } = useI18n();
  return <article className={`${styles.card} ${cardStyles.desktop}`} data-reference-id={item.id} data-current={current || undefined} data-copied={(current && copied) || undefined}
    aria-label={item.title} aria-hidden={!current || undefined} draggable={current}
    onDragStartCapture={current ? onDragStart : undefined} onDragEnd={onDragEnd} onClick={onActivate}>
    <div className={styles.cover}><PreviewArtwork key={item.preview} item={item} /></div>
    <div className={styles.row}>
      <span className={styles.mark}><ReferenceMark item={item} /></span>
      <h3>{item.title}</h3>
      <span className={styles.copy} onClick={event => event.stopPropagation()}>
        <CopyForAI responsiveLabel copied={copied} onCopy={onCopy} label={t('Copy {title} for AI', { title: item.title })} />
      </span>
    </div>
  </article>;
}
