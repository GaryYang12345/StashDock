import { createRoot } from 'react-dom/client';
import { ReferenceCardView } from '../../src/components/StashCard';
import { Button } from '../../src/components/arc/button/button';
import type { StashItem } from '../../src/types';
import '../../src/index.css';
import '../../src/components/arc/foundation.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/geist';

const file = (id: string, title: string, name: string, mimeType = ''): StashItem => ({ id, title, kind: name.endsWith('.pdf') ? 'pdf' : name.match(/\.(png|jpg)$/) ? 'image' : 'file', source: 'Local file', content: '', excerpt: '', tags: [], createdAt: '2026-10-15', mimeType, hasFile: true, origin: { fileName: name, importMethod: 'local_file', platform: 'Local file' } });
const items: StashItem[] = [
  { id: 'web', title: 'Public web page', kind: 'web', source: 'example.com', content: '', excerpt: '', tags: [], createdAt: '2026-10-15', url: 'https://example.com' },
  { id: 'repo', title: 'Code repository', kind: 'repo', source: 'github.com', content: '', excerpt: '', tags: [], createdAt: '2026-10-15', url: 'https://github.com/example/repo' },
  { id: 'note', title: 'Research note', kind: 'note', source: 'Personal note', content: '', excerpt: '', tags: [], createdAt: '2026-10-15' },
  file('pdf', 'Paper.pdf', 'paper.pdf', 'application/pdf'), file('doc', 'Project brief.docx', 'brief.docx'), file('sheet', 'Experiment results.xlsx', 'results.xlsx'),
  file('slides', 'Presentation.pptx', 'presentation.pptx'), file('csv', 'Dataset.csv', 'dataset.csv', 'text/csv'),
  file('image', 'Reference image', 'reference.png', 'image/png'), file('video', 'Interview clip', 'interview.mp4', 'video/mp4'), file('audio', 'Voice memo', 'memo.m4a', 'audio/mp4'),
  file('code', 'Parser.ts', 'parser.ts', 'text/typescript'), file('python', 'Analysis.py', 'analysis.py'), file('archive', 'Assets.zip', 'assets.zip', 'application/zip'),
  file('markdown', 'Meeting notes.md', 'notes.md', 'text/markdown'), file('text', 'Plain text.txt', 'notes.txt', 'text/plain'),
  file('data', 'Settings.json', 'settings.json', 'application/json'), file('yaml', 'Configuration.yaml', 'config.yaml', 'text/yaml'), file('file', 'Other file.bin', 'artifact.bin'),
];

function Fixture() {
  return <main data-arc-ui style={{ minHeight: '100dvh', padding: 24, background: 'var(--background)' }}>
    <h1 style={{ margin: '0 0 16px', fontSize: 'var(--text-xl)', fontWeight: 500 }}>Reference default covers</h1>
    <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)' }}>Visual samples only. Your library is unchanged.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 16 }}>
      {items.map(item => <ReferenceCardView key={item.id} item={item} selected={false} view="grid" onToggle={() => {}} onFavorite={() => {}} onDelete={() => {}} onOpen={() => {}} onEdit={() => {}} action={<Button size="sm">Add</Button>} />)}
    </div>
  </main>;
}

document.documentElement.dataset.theme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light';
createRoot(document.getElementById('root')!).render(<Fixture />);
