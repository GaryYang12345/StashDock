// Isolated browser library. Never writes to the real SQLite database.
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import LibraryView from '../../src/features/library/LibraryView';
import { TooltipLayer } from '../../src/components/TooltipLayer';
import '../../src/index.css';
import '../../src/components/arc/foundation.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/geist';
import './selection-motion-probe';

const dark = new URL(location.href).searchParams.get('theme') === 'dark';
document.documentElement.dataset.theme = dark ? 'dark' : 'light';
document.documentElement.dataset.accent = dark ? 'blue' : 'neutral';

const base = { source: 'Fixture', excerpt: '', createdAt: '2026-10-19', content: '# Project context\n\n## Rules\n\n- Keep original files\n- **Preserve tags**\n\n```ts\nconst ready = true;\n```\n\n| Type | Count |\n| --- | --- |\n| Files | 2 |\n\n- [x] Checked', previewStatus: 'ready' };
localStorage.setItem('stashdock.items.v1', JSON.stringify([
  { ...base, id: 'codex-file', title: 'Codex file', kind: 'file', tags: ['Codex'] },
  { ...base, id: 'codex-web', title: 'Codex web', kind: 'web', url: 'https://example.org', tags: ['Codex'] },
  { ...base, id: 'other-file', title: 'Other file', kind: 'file', tags: ['Other'] },
]));
createRoot(document.getElementById('root')!).render(<MotionConfig reducedMotion={new URL(location.href).searchParams.has('reduced') ? 'always' : 'user'}><TooltipLayer /><LibraryView /></MotionConfig>);
