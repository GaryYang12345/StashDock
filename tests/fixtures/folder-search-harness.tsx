// Isolated folder search fixture: mocked IPC, synthetic references, no library.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';
import { DesktopPreferencesProvider } from '../../src/features/settings/preferences';
import { FolderSearch } from '../../src/features/folder-search/FolderSearch';
import '../../src/index.css';
import '../../src/components/arc/foundation.css';
import '@fontsource-variable/inter';

const titles = ['Pricing page teardown', 'Onboarding flow review', 'Interview notes · week 3', 'Brand guidelines.pdf', 'API rate limits', 'Design tokens reference', 'Dashboard patterns', 'Research synthesis.docx'];
const params = new URLSearchParams(location.search);
const items = (params.has('notes') ? Array.from({length:5},(_,i)=>`Search acceptance ${i+1}`) : titles).map((title, i) => params.has('notes') || i % 3 === 2
  ? { id: `r${i}`, title, kind: 'note', source: 'Personal note', content: '', excerpt: '', tags: [], createdAt: '2026-10-20T00:00:00Z' }
  : { id: `r${i}`, title, kind: 'web', source: 'example.com', url: `https://example.com/${i}`, content: '', excerpt: '', tags: [], createdAt: '2026-10-20T00:00:00Z' });
const calls: unknown[] = [];
Object.assign(window, { __calls: calls });
Object.defineProperty(globalThis, 'isTauri', { value: true, configurable: true });
mockWindows('search');
mockIPC(async (command, raw) => {
  const args = raw as Record<string, unknown>;
  if (command.startsWith('folder_search_')) calls.push([command, args]);
  switch (command) {
    case 'desktop_runtime_ready': return;
    case 'get_desktop_settings': return { preferences: { language: 'en', theme: params.get('theme') || 'light', shortcut: 'Ctrl+Shift+Space', floatingWindow: true }, launchAtLogin: false, version: '0.2.5', githubUrl: null };
    case 'folder_search_status': return { open: params.get('open') !== '0', anchorPx: params.get('anchor') ? Number(params.get('anchor')) * devicePixelRatio : null };
    case 'search_items': return items.filter(item => item.title.toLowerCase().includes(String(args.query).toLowerCase())).map(item => item.id);
    case 'get_items': return (args.ids as string[]).map(id => items.find(item => item.id === id)).filter(Boolean);
    case 'copy_reference_file': document.documentElement.dataset.copied = String(args.itemIds); return;
    default: return undefined;
  }
}, { shouldMockEvents: true });
Object.assign(window, { __emit: emit });
document.documentElement.classList.add('desktop-search'); document.body.classList.add('desktop-search');
if (params.has('specimen')) {
  const style = document.createElement('style');
  // Match the native screenshot's white transparency backdrop in BOTH themes;
  // Chrome's dark colour-scheme canvas must not bias the side-card comparison.
  style.textContent = 'html,body{background:white!important} #root > div { inset:0 auto auto 0; width:480px; height:316px }';
  document.head.append(style);
  const button = document.createElement('button'); button.textContent = 'Measure reference layout';
  button.style.cssText = 'position:absolute;left:520px;top:32px;padding:12px';
  const metrics = document.createElement('pre'); metrics.style.cssText = 'position:absolute;left:520px;top:96px;font:12px monospace';
  button.onclick = () => {
    const card = document.querySelector('article[data-current]');
    const nodes = { button:card?.querySelector('button'), field:document.querySelector('input')?.parentElement, input:document.querySelector('input'), card, cover:card?.firstElementChild, row:card?.lastElementChild, title:card?.querySelector('h3') };
    metrics.textContent = JSON.stringify(Object.fromEntries(Object.entries(nodes).map(([name,node]) => {
      if (!node) return [name,null]; const s = getComputedStyle(node), r = node.getBoundingClientRect();
      return [name,{x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,border:s.border,background:s.backgroundColor,padding:s.padding,shadow:s.boxShadow}];
    })),null,2);
  };
  document.body.append(button,metrics);
  const feedback = document.createElement('button'); feedback.textContent = 'Preview Copy feedback';
  feedback.style.cssText = 'position:absolute;left:800px;top:32px;padding:12px';
  // Drive the actual component callback in this synthetic-only specimen. Native
  // automation cannot reliably establish Chromium :hover in a background tab.
  feedback.onclick = () => { const copy = document.querySelector<HTMLButtonElement>('article[data-current] button'); copy?.focus(); copy?.click(); };
  document.body.append(feedback);
  if (params.has('motion-frame')) {
    const freeze = document.createElement('button'); freeze.textContent = 'Freeze turn at 130ms';
    freeze.style.cssText = 'position:absolute;left:800px;top:80px;padding:12px';
    freeze.onclick = () => {
      document.querySelector('input')?.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
      window.setTimeout(() => {
        const stage = document.querySelector('[class*="stage3d"]');
        if (!stage) return;
        // A snapshot of the actual rendered Windows component, not a parallel
        // reimplementation of its geometry or painting. Reload to unfreeze.
        const snapshot = stage.cloneNode(true) as HTMLElement;
        stage.replaceWith(snapshot);
        metrics.textContent = JSON.stringify([...snapshot.children].map(node => ({
          transform:(node as HTMLElement).style.transform,opacity:(node as HTMLElement).style.opacity,
        })),null,2);
      },130);
    };
    document.body.append(freeze);
  }
}
createRoot(document.getElementById('root')!).render(<StrictMode><MotionConfig reducedMotion="user"><DesktopPreferencesProvider><FolderSearch /></DesktopPreferencesProvider></MotionConfig></StrictMode>);
