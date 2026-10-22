import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FluidDialog } from '../../components/FluidDialog';
import { Button } from '../../components/arc/button/button';
import brandMark from '../../../assets/brand/icon.svg';
import { GitHubMark } from './GitHubMark';
import { useI18n } from './locale';
import styles from './UpdateDialog.module.css';

export type UpdateInfo = { status: 'unconfigured' | 'current' | 'available'; version: string | null; url: string | null };
type State = { phase: 'checking' } | { phase: 'done'; update: UpdateInfo } | { phase: 'failed'; error: string };
// A quick answer still shows the check, so the result does not flash in.
const MIN_CHECK_MS = 600;
export const versionLabel = (version: string) => `v${version.replace(/^v/i, '')}`;

// Desktop-only: plugin updates belong to their host. Shares the import progress
// surface (grey brand mark, centred status) without a progress bar.
export function UpdateDialog({ open, version, onClose, openLink }: { open: boolean; version: string; onClose: () => void; openLink: (url: string) => Promise<unknown> }) {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ phase: 'checking' });
  const [attempt, setAttempt] = useState(0);
  const [linkError, setLinkError] = useState('');
  const current = useRef(0);
  useEffect(() => {
    if (!open) return;
    const request = ++current.current;
    setState({ phase: 'checking' }); setLinkError('');
    const started = performance.now();
    const settle = (next: State) => {
      const wait = Math.max(0, MIN_CHECK_MS - (performance.now() - started));
      setTimeout(() => { if (request === current.current) setState(next); }, wait);
    };
    invoke<UpdateInfo>('check_desktop_updates').then(update => settle({ phase: 'done', update }), reason => settle({ phase: 'failed', error: String(reason) }));
    return () => { current.current++; };
  }, [open, attempt]);
  const update = state.phase === 'done' ? state.update : null;
  const available = update?.status === 'available' && update.url ? update : null;
  const title = state.phase === 'checking' ? t('Checking for updates') : state.phase === 'failed' ? t('Updates could not be checked') : available ? t('Update available') : update?.status === 'current' ? t('You are up to date.') : t('No public release yet');
  const detail = state.phase === 'failed' ? t(state.error) : available ? t('Version {version} is available. You have {current}.', { version: versionLabel(available.version || ''), current: versionLabel(version) })
    : update?.status === 'current' ? `StashDock Desktop ${versionLabel(version)}` : t('Updates will be available after the public release.');
  return <FluidDialog open={open} onClose={onClose} onExited={() => setState({ phase: 'checking' })} title={title} progress={<div className={styles.surface}>
    <img className={styles.mark} src={brandMark} alt="" draggable={false} aria-hidden="true" />
    <p className={styles.title} role="status" aria-live="polite">{title}</p>
    <div className={styles.detail}>{state.phase === 'checking' ? <span className={styles.spinner} aria-hidden="true" /> : <p>{detail}</p>}</div>
    {linkError && <p className={styles.error} role="alert">{t(linkError)}</p>}
    <div className={styles.actions}>
      {state.phase === 'failed' && <Button variant="secondary" size="sm" onClick={() => setAttempt(value => value + 1)}>{t('Retry')}</Button>}
      <Button variant={available ? 'secondary' : state.phase === 'failed' ? 'ghost' : 'secondary'} size="sm" onClick={onClose}>{t(state.phase === 'checking' ? 'Cancel' : available ? 'Not now' : 'Done')}</Button>
      {available && <Button variant="primary" size="sm" onClick={() => { setLinkError(''); void openLink(available.url!).then(onClose, reason => setLinkError(String(reason))); }}><GitHubMark size={16} />{t('Update on GitHub')}</Button>}
    </div>
  </div>} >{null}</FluidDialog>;
}
