import { useI18n } from '../features/settings/locale';
import { GripVertical, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { startReferenceDrag, endReferenceDrag } from "../lib/reference-drag";
import type { StashItem } from "../types";
import { Button } from "./arc/button/button";
import { CopyForAI } from "./CopyForAI";
import { SelectAllReferences } from "./SelectAllReferences";
import { motionTokens } from "./arc/lib/motion-tokens";
import styles from "./ContextBar.module.css";

type ContextBarProps = { items: StashItem[]; copied?: boolean; onCopy: () => Promise<void>; onClear: () => void; compact?: boolean; onSelectAll?: () => void; allSelected?: boolean };
export function ContextBar({ items, copied, onCopy, onClear, compact = false, onSelectAll, allSelected = false }: ContextBarProps) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const startDrag = (event: React.DragEvent<HTMLElement>) => {
    startReferenceDrag(event, items);
  };
  return <AnimatePresence initial={false}>{items.length > 0 && <motion.div data-arc-ui className={`${styles.position} ${compact ? styles.compact : ""}`}
    initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : 4, transition: { duration: reduced ? 0 : motionTokens.duration.exit } }}
    transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
    <div className={styles.bar} draggable onDragStartCapture={startDrag} onDragEnd={endReferenceDrag} role="region" aria-label={t("Selected references")}>
      <div className={styles.selectionInfo}>
        <GripVertical className={styles.grip} size={16} strokeWidth={1.75} aria-hidden="true" />
        <div className={styles.summary}>
          <div className={styles.summaryHeading}><p role="status">{t('{count} selected', { count: items.length })}</p>{onSelectAll && <SelectAllReferences onSelectAll={onSelectAll} allSelected={allSelected} />}</div>
          <span>{t("Drag or copy to your AI app")}</span>
        </div>
      </div>
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onClear} aria-label={t("Clear selection")}><X size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
        <CopyForAI copied={copied} onCopy={onCopy} />
      </div>
    </div>
  </motion.div>}</AnimatePresence>;
}
