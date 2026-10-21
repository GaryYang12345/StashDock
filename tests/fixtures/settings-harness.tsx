// Isolated native-IPC fixture. No real library, registry, clipboard or host calls.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { DesktopPreferencesProvider, useDesktopPreferences, type DesktopPreferences } from '../../src/features/settings/preferences';
import LibraryView from '../../src/features/library/LibraryView';
import { TooltipLayer } from '../../src/components/TooltipLayer';
import '../../src/index.css';
import '../../src/components/arc/foundation.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/geist';
const items = ['Settings', 'A saved reference'].map((title, i) => ({ id: String(i), title, kind: 'note', hasFile: true, source: 'Personal note', content: 'User content stays unchanged', excerpt: '', tags: ['Settings'], createdAt: '2026-10-15T00:00:00Z' }));
items[0].tags.push(...Array.from({ length: 30 }, (_, i) => `Tag ${i + 1}`));
let preferences: DesktopPreferences = { floatingWindow: true, ...JSON.parse(sessionStorage.getItem('settings-fixture') || '{"language":"en","theme":"light","shortcut":"Ctrl+Shift+Space"}') };
let startup = false;
Object.defineProperty(globalThis, 'isTauri', { value: true, configurable: true });
mockWindows('main');
mockIPC(async (command, raw) => {
  const args = raw as Record<string, unknown>;
  await new Promise(resolve => setTimeout(resolve, 50));
  switch (command) {
    case 'get_integration_status': document.documentElement.dataset.presenceChecks=String(Number(document.documentElement.dataset.presenceChecks||'0')+1); return { items: [{ id: 'codex', detected: !new URLSearchParams(location.search).has('no-agent') && sessionStorage.getItem('fixture-agent-disabled')!=='1' }, ...['chrome', 'edge', 'firefox'].map(id => ({ id, detected: new URLSearchParams(location.search).has('browsers-detected') }))], links: {}, githubUrl: new URLSearchParams(location.search).has('github-fixture') ? 'https://github.com/example/stashdock-test-fixture' : null };
    case 'open_integration': if(sessionStorage.getItem('fixture-open-failure'))throw 'The app could not be opened. Try again.'; document.documentElement.dataset.openedIntegration = String(args.id); return;
    case 'get_desktop_settings': return { preferences, launchAtLogin: startup, version: '0.2.2', githubUrl: null };
    case 'save_desktop_preferences': {
      const next = args.preferences as DesktopPreferences;
      if (next.shortcut === 'Ctrl+Alt+Space') throw 'This shortcut is in use by another app. Choose another shortcut.';
      preferences = next; sessionStorage.setItem('settings-fixture', JSON.stringify(next)); return next;
    }
    case 'get_storage_info': return { path: 'D:\\Fixture\\StashDock library with a deliberately long folder name\\Saved references', bytes: 2345678, references: items.length };
    case 'set_launch_at_login': startup = args.enabled as boolean; return startup;
    case 'check_desktop_updates': return { status: 'unconfigured', version: null, url: null };
    case 'open_storage_folder': document.documentElement.dataset.fixtureFolderOpened = 'true'; return;
    case 'plugin:dialog|open': return 'D:\\Fixture\\New storage';
    case 'move_library': {
      if (!sessionStorage.getItem('settings-fixture-allow-move')) throw 'Choose an empty folder so existing files are not overwritten.';
      return args.path;
    }
    case 'restart_desktop': document.documentElement.dataset.fixtureRestarted = 'true'; return;
    case 'list_items': return items;
    case 'open_reference_file': document.documentElement.dataset.openedReference = String(args.id); return;
    case 'search_items': return items.filter(item => item.title.toLowerCase().includes(String(args.query).toLowerCase())).map(item => item.id);
    case 'list_pinned_tags': case 'list_browser_sources': return [];
    case 'preview_link': return { title: 'Example page', content: 'Example page content' };
    default: return undefined;
  }
}, { shouldMockEvents: true });
document.documentElement.classList.add('desktop-native'); document.body.classList.add('desktop-native');
function FixtureShelf() { const {info}=useDesktopPreferences(); return <LibraryView onCollapse={()=>{}} floatingWindow={info?.preferences.floatingWindow??true} />; }
createRoot(document.getElementById('root')!).render(<StrictMode><MotionConfig reducedMotion="user"><DesktopPreferencesProvider><TooltipLayer /><FixtureShelf /></DesktopPreferencesProvider></MotionConfig></StrictMode>);
