import { useId } from 'react';
import { Check } from 'lucide-react';
import { useI18n } from './locale';
import type { Appearance } from './SettingsParts';
import styles from './ThemeChoice.module.css';

type Theme = Appearance['theme'];

// An inert illustration, not a second application or a screenshot request.
// Both halves use the same geometry, so automatic mode has one continuous UI.
function Miniature({ theme }: { theme: 'light' | 'dark' }) {
  return <span className={styles.miniature} data-preview-theme={theme}>
    <span className={styles.sidebar}><span className={styles.brand} /><span className={styles.nav} /><span className={styles.nav} /><span className={styles.nav} /></span>
    <span className={styles.shelf}>
      <span className={styles.toolbar}><span /><span /></span>
      <span className={styles.search} />
      <span className={styles.cards}>{[0, 1].map(index => <span className={styles.card} key={index}><span className={styles.cover} /><span className={styles.line} /><span className={styles.caption} /></span>)}</span>
    </span>
  </span>;
}

export function ThemeChoice({ value, disabled, host, onChange }: { value: Theme; disabled?: boolean; host: boolean; onChange: (theme: Theme) => void }) {
  const { t } = useI18n();
  const name = useId();
  const options: { value: Theme; label: string }[] = [
    { value: 'light', label: t('Light') },
    { value: 'dark', label: t('Dark') },
    { value: 'system', label: t(host ? 'Automatic' : 'Follow system') },
  ];
  // Keep keyboard focus during the short save. Native `disabled` blurs the
  // selected radio; aria-disabled plus blocked input preserves the group.
  return <fieldset className={styles.group} aria-disabled={disabled || undefined}>
    <legend className={styles.legend}>{t('Theme')}</legend>
    {options.map(option => <label className={styles.option} key={option.value}>
      <input className={styles.radio} type="radio" name={name} value={option.value} checked={value === option.value} aria-disabled={disabled || undefined} onClick={event => { if (disabled) event.preventDefault(); }} onChange={() => { if (!disabled) onChange(option.value); }} />
      <span className={styles.preview} data-mode={option.value} aria-hidden="true">
        {option.value !== 'dark' && <Miniature theme="light" />}
        {option.value !== 'light' && <Miniature theme="dark" />}
      </span>
      <span className={styles.label}><span>{option.label}</span><Check className={styles.check} size={12} strokeWidth={1.75} aria-hidden="true" /></span>
    </label>)}
  </fieldset>;
}
