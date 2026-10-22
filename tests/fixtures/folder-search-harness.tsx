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
const items = titles.map((title, i) => i % 3 === 2
  ? { id: `r${i}`, title, kind: 'note', source: 'Personal note', content: '', excerpt: '', tags: [], createdAt: '2026-10-20T00:00:00Z' }
  : { id: `r${i}`, title, kind: 'web', source: 'example.com', url: `https://example.com/${i}`, content: '', excerpt: '', tags: [], createdAt: '2026-10-20T00:00:00Z' });
const params = new URLSearchParams(location.search);
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
    case 'folder_search_status': return { open: params.get('open') !== '0', upward: params.get('down') === null, anchorX: Number(params.get('anchor') || 240) };
    case 'search_items': return items.filter(item => item.title.toLowerCase().includes(String(args.query).toLowerCase())).map(item => item.id);
    case 'get_items': return (args.ids as string[]).map(id => items.find(item => item.id === id)).filter(Boolean);
    case 'copy_reference_file': document.documentElement.dataset.copied = String(args.itemIds); return;
    default: return undefined;
  }
}, { shouldMockEvents: true });
Object.assign(window, { __emit: emit });
document.documentElement.classList.add('desktop-search'); document.body.classList.add('desktop-search');
createRoot(document.getElementById('root')!).render(<StrictMode><MotionConfig reducedMotion="user"><DesktopPreferencesProvider><FolderSearch /></DesktopPreferencesProvider></MotionConfig></StrictMode>);
