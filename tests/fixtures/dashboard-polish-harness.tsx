// Production dashboard with isolated browser storage. No native IPC or real DB writes.
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import LibraryView from '../../src/features/library/LibraryView';
import type { StashItem } from '../../src/types';
import '../../src/index.css';
import '../../src/components/arc/foundation.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/geist';

const items: StashItem[] = ['Research notes', 'Design references', 'Product decisions'].map((title, i) => ({
  id: String(i), title, kind: 'note', source: 'Personal note', content: 'Fixture context',
  excerpt: '', tags: ['Research'], createdAt: '2026-10-14T00:00:00Z',
}));
localStorage.setItem('stashdock.items.v1', JSON.stringify(items));
createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="user"><LibraryView onCollapse={() => {}} /></MotionConfig>,
);
