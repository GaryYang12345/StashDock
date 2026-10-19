import { useEffect, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LoadingReferences } from './LoadingReferences';
import { Alert } from './arc/alert/alert';
import { Button } from './arc/button/button';
import { useI18n } from '../features/settings/locale';

// Cold-start gate only. A window handoff never resets this state or remounts
// the library. Child effects must not race Tauri's initial state registration.
export function DesktopReady({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true; setError('');
    void invoke('desktop_runtime_ready').then(() => { if (alive) setReady(true); }).catch(reason => { if (alive) setError(String(reason)); });
    return () => { alive = false; };
  }, [attempt]);
  if (ready) return children;
  return error ? <Alert tone="danger" title={t('StashDock could not start')}><span>{t(error)}</span><Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>{t('Retry')}</Button></Alert> : <LoadingReferences />;
}
