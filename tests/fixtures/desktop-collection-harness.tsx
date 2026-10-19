// Browser-only test data. Never connects to the user's SQLite library.
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import LibraryView from '../../src/features/library/LibraryView';
import { TooltipLayer } from '../../src/components/TooltipLayer';
import '../../src/index.css';
import '../../src/components/arc/foundation.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/geist';

localStorage.setItem('stashdock.items.v1', JSON.stringify(Array.from({ length: 6 }, (_, index) => ({
  id: `collection-fixture-${index}`, title: `Document preview ${index + 1}`, kind: 'web', source: 'Example',
  url: 'https://example.org', excerpt: '', tags: ['Fixture'], createdAt: '2026-10-11', previewStatus: 'queued',
}))));
createRoot(document.getElementById('root')!).render(<MotionConfig reducedMotion="user"><TooltipLayer /><LibraryView /></MotionConfig>);
