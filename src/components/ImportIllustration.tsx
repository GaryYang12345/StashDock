import { Image, Link } from 'lucide-react';
import styles from './ImportIllustration.module.css';

function Paper({ kind }: { kind: 'text' | 'image' | 'link' }) {
  return <div className={styles.paper}>
    {kind === 'image' ? <div className={styles.photo}><Image size={26} strokeWidth={1.5} /></div>
      : <div className={styles.top}>{kind === 'link' ? <Link size={22} strokeWidth={1.75} /> : <span />}</div>}
    <div className={styles.lines}><i /><i /><i /></div>
  </div>;
}

// Approved C2 artwork at 85% strength. Decorative only, shared by both hosts.
export function ImportIllustration() {
  return <div className={styles.artwork} aria-hidden="true">
    <div className={styles.papers}><Paper kind="text" /><Paper kind="image" /><Paper kind="link" /></div>
  </div>;
}
