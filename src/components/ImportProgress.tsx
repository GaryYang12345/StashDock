import { useEffect, useId } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useI18n } from '../features/settings/locale';
import { Progress } from './arc/progress/progress';
import { motionTokens } from './arc/lib/motion-tokens';
import { ImportIllustration } from './ImportIllustration';
import styles from './ImportProgress.module.css';

// Shared by both hosts. Progress follows completed work, never an estimated timer.
export function ImportProgress({ completed, total }: { completed: number; total: number }) {
  const { t } = useI18n();
  const labelId = useId();
  const reduced = useReducedMotion();
  const max = total > 0 ? total : 1;
  const percentage = Math.round(Math.min(Math.max(completed, 0), max) / max * 100);
  const count = useMotionValue(percentage);
  const text = useTransform(count, value => `${Math.round(value)}%`);
  useEffect(() => {
    if (reduced) { count.jump(percentage); return; }
    const controls = animate(count, percentage, motionTokens.spring.smooth);
    return () => controls.stop();
  }, [percentage, reduced, count]);
  return <div>
    <div className={styles.illustration}><ImportIllustration /></div>
    <div className={styles.heading}>
      <span id={labelId} className={styles.title}>{t('Importing references')}</span>
    </div>
    <div className={styles.progressRow}>
      <Progress max={max} value={completed} aria-labelledby={labelId} aria-live="polite" />
      <motion.span className={styles.percentage} aria-hidden="true">{text}</motion.span>
    </div>
  </div>;
}
