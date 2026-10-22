import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { DesktopImportDialog } from '../../src/components/DesktopImportDialog';
import { ReferenceEditor } from '../../src/components/ReferenceEditor';
import { TooltipLayer } from '../../src/components/TooltipLayer';
import type { StashItem } from '../../src/types';
import type { LinkImportService } from '../../src/lib/linkImport';
import { editReferenceCover } from '../../src/lib/referenceCover';
import '../../src/index.css';
import '../../src/components/arc/foundation.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/geist';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let holdReads = new URLSearchParams(location.search).has('hold-import');
const pendingReads: (() => void)[] = [];
const fixtureControls = window as typeof window & { completeOneImport?: () => void; releaseImports?: () => void; savedImports?: StashItem[] };
fixtureControls.completeOneImport = () => pendingReads.shift()?.();
fixtureControls.releaseImports = () => { holdReads = false; pendingReads.splice(0).forEach(resolve => resolve()); };
const service: LinkImportService = {
  // Browser-only cover adapter for UI tests. Native decoder is tested separately.
  prepareCover: async file => {
    await wait(250);
    if (file.name.includes('invalid')) throw Error('Choose a PNG, JPG, WebP or GIF image.');
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 150;
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, 240, 150);
      return canvas.toDataURL('image/jpeg', .8);
    } finally { bitmap.close(); }
  },
  listCapturePlatforms: async () => JSON.parse(sessionStorage.getItem('fixture-platforms') || '[]'),
  saveCapturePlatform: async url => { const values = JSON.parse(sessionStorage.getItem('fixture-platforms') || '[]'); const host = new URL(url).hostname; if (!values.some((value: { url: string }) => value.url === url)) values.push({ id: `custom:${url}`, name: host, host, url }); sessionStorage.setItem('fixture-platforms', JSON.stringify(values)); return values; },
  openCaptureSite: async site => { document.documentElement.dataset.openedSite = site; },
  available: () => true,
  sources: async () => { await wait(900); return [{ id: 'chrome:Default', browser: 'Chrome', profile: 'Personal' }, { id: 'chrome:Profile 1', browser: 'Chrome', profile: 'Work' }, { id: 'edge:Default', browser: 'Edge', profile: 'Work' }, { id: 'firefox:default', browser: 'Firefox', profile: 'Default' }]; },
  bookmarks: async id => { await wait(200); if (id.startsWith('edge')) throw 'Close Edge and retry this fixture import.'; if (id === 'chrome:Profile 1') return [{ title: 'Other profile', url: 'https://example.org/other-profile', folderPath: ['Work'] }]; return Array.from({ length: new URLSearchParams(location.search).has('short') ? 7 : 125 }, (_, i) => ({ title: i === 0 ? 'Already saved' : `Reference ${i}`, url: `https://example.org/${i}`, folderPath: ['Bookmarks bar', 'Research'], savedAt: '2026-01-01T00:00:00Z' })); },
  preview: async url => { if (holdReads) await new Promise<void>(resolve => pendingReads.push(resolve)); await wait(url.includes('slow') ? 1800 : 300); if (url.includes('fail') || (new URLSearchParams(location.search).has('mixed') && url.endsWith('/2'))) throw 'This page requires access. Enter its details manually.'; return { title: `Detected ${new URL(url).pathname.slice(1) || 'page'}`, content: 'Actual test page\n\nComplete test content.', faviconUrl: 'https://example.org/icon.png' }; },
};
// ?chosen simulates the system file dialog: originals are referenced by token, never sent as bytes.
const chosenFileProps = new URLSearchParams(location.search).has('chosen') ? {
  onChooseFiles: async () => { await wait(150); return [
    { token: 'token-plan', name: 'Plan.md', size: 2048, mimeType: 'text/markdown', content: '# Plan\nShip the import fix.' },
    { token: 'token-paper', name: 'Large paper.pdf', size: 24 * 1024 * 1024, mimeType: 'application/pdf', content: '' }]; },
  onImportChosenFiles: async (files: { token: string; title: string; content: string }[], tags: string[]) => { await wait(100); return files.map(file => ({ ...saved, id: file.token, kind: file.token === 'token-paper' ? 'pdf' : 'file', title: file.title, url: undefined, source: 'Local file', tags, content: file.content, hasFile: true } as StashItem)); },
} : {};
const saved = { id: 'saved', title: 'Already saved', kind: 'web', source: 'example.org', url: 'https://example.org/0', excerpt: '', tags: [], createdAt: '2026-01-01T00:00:00Z' } as StashItem;
const availableTags = ['Research', 'UI', 'Agents', ...Array.from({ length: 80 }, (_, i) => `Existing tag ${i}`)];
function Fixture() {
  const [open, setOpen] = useState(false), [added, setAdded] = useState<StashItem[]>([]), [failSave, setFailSave] = useState(false);
  const [editing, setEditing] = useState(false);
  fixtureControls.savedImports = added;
  const [editorItem, setEditorItem] = useState<StashItem>(saved);
  return <MotionConfig reducedMotion="user"><TooltipLayer /><p>Isolated import fixture. Browser sources, web lookup and file import are simulated. No real library writes.</p><button onClick={() => setOpen(true)}>Open import fixture</button><button onClick={() => setEditing(true)}>Open editor fixture</button><label><input type="checkbox" checked={failSave} onChange={event => setFailSave(event.target.checked)} />Simulate save failure</label><output id="saved-items">{JSON.stringify(added)}</output><ReferenceEditor item={editing ? editorItem : null} prepareCover={service.prepareCover} availableTags={availableTags} onClose={() => setEditing(false)} onSave={async (_, title, tags, cover) => { await wait(100); if (failSave) throw Error('Test save failed. Retry.'); const next = editReferenceCover({ ...editorItem, title, tags }, cover); setEditorItem(next); setAdded([next]); }} /><DesktopImportDialog open={open} onClose={() => setOpen(false)} {...chosenFileProps} availableTags={availableTags} existingItems={[saved]} services={new URLSearchParams(location.search).has('no-cover') ? { ...service, prepareCover: undefined } : service} onImportFiles={async (files, tags) => files.map((file, index) => ({ ...saved, id: `file-fixture-${index}`, kind: 'file', title: file.title, url: undefined, source: 'Local file', tags, content: file.content, mimeType: file.mimeType, hasFile: true, preview: file.preview, origin: { platform: 'Local file', importMethod: 'local_file', importedAt: new Date().toISOString(), fileName: file.name, ...(file.preview ? { previewKind: 'cover', previewSource: 'custom' } : {}) } }))} onAdd={async items => { await wait(100); if (failSave) throw new Error('Test save failed. Retry.'); setAdded(previous => [...previous, ...items]); }} /></MotionConfig>;
}
const fixtureRoot = document.getElementById('root')!;
if (new URLSearchParams(location.search).has('native')) {
  fixtureRoot.className = 'floating-layer';
  fixtureRoot.dataset.surface = 'library'; fixtureRoot.dataset.active = 'true';
  Object.assign(fixtureRoot.style, { left: '240px', top: '260px', width: '1000px', height: '620px', transform: 'scale(.9)', transformOrigin: '0 0', background: 'var(--surface)' });
}
import { StrictMode } from 'react';
createRoot(fixtureRoot).render(new URLSearchParams(location.search).has('strict') ? <StrictMode><Fixture /></StrictMode> : <Fixture />);
