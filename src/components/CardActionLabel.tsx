import styles from './StashCard.module.css';

/** Preserve the full accessible button name; shorten only its visible label on narrow cards. */
export function CardActionLabel({ children, compact }: { children: string; compact: string }) {
  return <><span className={styles.actionLabelFull}>{children}</span><span className={styles.actionLabelCompact}>{compact}</span></>;
}
