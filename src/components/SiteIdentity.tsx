import { useState } from "react";
import type { StashItem } from "../types";
import { faviconCandidates, siteLabel } from "../lib/siteIdentity";
import styles from "./SiteIdentity.module.css";
import { fileReferenceType, isFileReference } from '../lib/fileReference';
import { ReferenceGlyph, referenceVisual } from './ReferenceVisual';
import { useI18n } from '../features/settings/locale';

export function SiteFavicon({ candidates, label, remoteFallback = true }: { candidates: string[]; label: string; remoteFallback?: boolean }) {
  const sources = remoteFallback ? candidates : candidates.filter(source => source.startsWith('data:'));
  // Async enrichment changes the candidate sequence. A failed previous index
  // must never skip a newly arrived cached/inline icon.
  return <FaviconImages key={sources.join('|')} candidates={sources} label={label} />;
}

function FaviconImages({ candidates, label }: { candidates: string[]; label: string }) {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  return <span className={styles.favicon} aria-hidden="true">
    {!loaded && <span className={styles.initial}>{label.charAt(0).toLocaleUpperCase("en")}</span>}
    {candidates[index] && <img className={styles.icon} data-loaded={loaded || undefined} src={candidates[index]} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false}
      onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setIndex(current => current + 1); }} />}
  </span>;
}

export function SiteIdentity({ item }: { item: StashItem }) {
  const { t } = useI18n();
  if (isFileReference(item)) {
    const { label, visual } = fileReferenceType(item);
    return <span className={styles.source}><ReferenceGlyph kind={visual} size={16} /><span className={styles.label}>{t(label)}</span></span>;
  }
  if (item.kind === 'note') {
    const visual = referenceVisual(item);
    return <span className={styles.source}><ReferenceGlyph kind={visual.visual} size={16} /><span className={styles.label}>{t(visual.label)}</span></span>;
  }
  const label = siteLabel(item);
  const candidates = faviconCandidates(item);
  return <span className={styles.source}>
    <SiteFavicon candidates={candidates} label={label} />
    <span className={styles.label}>{label}</span>
  </span>;
}
