import { Icon, type IconifyIcon } from '@iconify/react/offline';
import type { StashItem } from '../types';
import { referenceIcons as generatedReferenceIcons } from '../generated/reference-icons';
import { fileReferenceType, isFileReference } from '../lib/fileReference';
import styles from './ReferenceVisual.module.css';
import { useI18n } from '../features/settings/locale';

export type ReferenceVisualKind = 'web' | 'repo' | 'note' | 'pdf' | 'document' | 'spreadsheet' | 'presentation' | 'archive' | 'video' | 'audio' | 'code' | 'data' | 'markdown' | 'text' | 'image' | 'file';

const referenceIcons: Record<ReferenceVisualKind, IconifyIcon> = generatedReferenceIcons;

export function referenceVisual(item: Pick<StashItem, 'kind' | 'title' | 'mimeType' | 'origin' | 'assetPath'>) {
  if (isFileReference(item)) return fileReferenceType(item);
  if (item.kind === 'repo') return { label: 'Repository', visual: 'repo' as const };
  if (item.kind === 'note') return { label: 'Note', visual: 'note' as const };
  return { label: 'Web page', visual: 'web' as const };
}

export function ReferenceGlyph({ kind, size = 18, className = '' }: { kind: ReferenceVisualKind; size?: number; className?: string }) {
  return <Icon className={`${styles.glyph} ${className}`} data-visual={kind} icon={referenceIcons[kind]} width={size} height={size} aria-hidden="true" />;
}

export function ReferenceDefaultCover({ item }: { item: Pick<StashItem, 'kind' | 'title' | 'mimeType' | 'origin' | 'assetPath'> }) {
  const { t } = useI18n();
  const visual = referenceVisual(item);
  return <div className={styles.cover} data-visual={visual.visual}>
    <ReferenceGlyph kind={visual.visual} size={76} className={styles.heroIcon} />
    <span className={styles.caption}>{t(visual.label)}</span>
  </div>;
}
