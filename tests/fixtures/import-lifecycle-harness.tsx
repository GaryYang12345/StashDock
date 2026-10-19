import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { ReferenceImportDialog, type ReferenceImportHandle } from '../../src/components/ReferenceImportDialog';
import type { LinkImportService } from '../../src/lib/linkImport';
import '../../src/index.css';
import '../../src/components/arc/foundation.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/geist';

const services: LinkImportService = {
  available: () => true,
  sources: async () => { await new Promise(resolve => setTimeout(resolve, 900)); return []; },
  bookmarks: async () => [],
  preview: async () => ({ title: 'Fixture link', content: 'Fixture content' }),
};
function Fixture() {
  const dialog = useRef<ReferenceImportHandle>(null), renders = useRef(0);
  const [active, setActive] = useState(true), [saved, setSaved] = useState(0);
  renders.current++;
  return <MotionConfig reducedMotion="user">
    <p>Isolated lifecycle fixture. No native or live library writes.</p>
    <output id="parent-renders">{renders.current}</output><output id="saved-count">{saved}</output>
    <button onClick={() => dialog.current?.open()}>Import references</button>
    <button onClick={() => setActive(value => !value)}>Toggle host activity</button>
    <ReferenceImportDialog ref={dialog} active={active} services={services} availableTags={['Research']} onAdd={async items => { setSaved(count => count + items.length); }} />
  </MotionConfig>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
