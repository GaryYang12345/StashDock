import { useI18n } from '../features/settings/locale';
import { Skeleton } from "./arc/skeleton/skeleton";
import styles from "./LoadingReferences.module.css";
export function LoadingReferences({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const { t } = useI18n();
  return <div data-arc-ui className={`${compact ? styles.list : styles.grid} ${className}`} aria-label={t("Loading references")} aria-busy="true">
    {Array.from({ length: compact ? 5 : 6 }, (_, index) => <div key={index} className={compact ? styles.row : styles.card}>
      <div className={styles.media} aria-hidden="true" /><Skeleton lines={3} label={t("Loading reference")} />
    </div>)}
  </div>;
}
