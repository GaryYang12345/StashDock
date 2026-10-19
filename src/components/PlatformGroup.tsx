import { MoreHorizontal } from 'lucide-react';
import { platformAvatar } from './PlatformIcon';
import styles from './PlatformGroup.module.css';

export function PlatformGroup() {
  return <><span className={styles.group} aria-hidden="true"><span className={styles.stack}>
    {(['x', 'xiaohongshu', 'zhihu'] as const).map(site => <img key={site} src={platformAvatar(site)} alt="" width={24} height={24} draggable={false} />)}</span>
    <span className={styles.more}><MoreHorizontal size={16} strokeWidth={1.75} /></span></span><span className={styles.accessibleName}>Platforms</span></>;
}
