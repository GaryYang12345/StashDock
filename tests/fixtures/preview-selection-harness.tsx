import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { MotionConfig } from 'motion/react';
import { PreviewArtwork } from '../../src/components/StashCard';
import { ContextBar } from '../../src/components/ContextBar';
import { Button } from '../../src/components/arc/button/button';
import { TooltipLayer } from '../../src/components/TooltipLayer';
import type { StashItem } from '../../src/types';
import '../../src/index.css';
import '../../src/components/arc/foundation.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/geist';

const base: StashItem = { id: 'preview-fixture', title: 'Preview fixture', kind: 'web', source: 'Example', excerpt: '', tags: [], createdAt: '2026-10-11', previewStatus: 'queued' };
function Fixture() {
  const [item, setItem] = useState(base), [selected, setSelected] = useState([base]);
  return <MotionConfig reducedMotion="user"><TooltipLayer /><p>Isolated preview fixture. No user-library writes.</p>
    <Button variant="secondary" onClick={() => setItem({ ...base, previewStatus: 'failed' })}>Fail preview</Button>
    <Button variant="secondary" onClick={() => setItem({ ...base, preview: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' })}>Complete preview</Button>
    <Button variant="secondary" onClick={() => setItem(base)}>Queue preview</Button>
    <div style={{ width: 'min(100%, 440px)', containerType: 'inline-size', containerName: 'desktop-card' }}><PreviewArtwork key={item.preview} item={item} /></div>
    <div style={{ position: 'relative', minHeight: 180, width: '100%' }}><ContextBar compact items={selected} onCopy={async () => {}} onClear={() => setSelected([])} allSelected={selected.length === 3} onSelectAll={() => setSelected([base, { ...base, id: 'two' }, { ...base, id: 'three' }])} /></div>
  </MotionConfig>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
