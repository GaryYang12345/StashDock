// Isolated form services. No Chrome API, external request or real library write.
import { renderPopup } from '../../src/features/browser-extension/Popup';
import type { StashItem } from '../../src/types';
import '../../src/components/arc/foundation.css';
import '../../src/styles/scrollbars.css';
import '../../extension/sidepanel.css';
import '@fontsource-variable/inter';
import { installTooltips } from '../../src/lib/tooltips';
import { motionTokens } from '../../src/components/arc/lib/motion-tokens';
import '../../src/styles/tooltips.css';

const disposeTooltips = installTooltips(document, { enter: motionTokens.duration.fast, exit: motionTokens.duration.instant, ease: motionTokens.ease.enter });
window.addEventListener('pagehide', disposeTooltips, { once: true });

declare global {
  interface Window {
    sidebarFixture: { mode: string; tagReads: number; captures: number; saves: number; replacements?: number; closes: number; unmount?: () => void; finishSave?: () => void; navigate?: () => void };
  }
}
const params = new URLSearchParams(location.search);
window.sidebarFixture = { mode: params.get('mode') || '', tagReads: 0, captures: 0, saves: 0, closes: 0 };
const page: StashItem = { id: 'fixture', kind: 'web', title: 'Fixture page', source: 'example.org', url: 'https://example.org/post', content: 'Full visible page content. This is isolated test data.', tags: [], createdAt: '2026-10-14T00:00:00Z' };
window.sidebarFixture.unmount = renderPopup(document.querySelector<HTMLElement>('#root')!, {
  ...(params.has('provider') ? { providerStatus: async () => ({ connected: window.sidebarFixture.mode !== 'offline' }) } : {}),
  subscribe: (_refresh, navigate) => { window.sidebarFixture.navigate = navigate; return () => { window.sidebarFixture.navigate = undefined; }; },
  capture: async () => {
    window.sidebarFixture.captures++;
    if (window.sidebarFixture.mode === 'read-error') throw Error('Fixture reading failed');
    return page;
  },
  tags: async () => { window.sidebarFixture.tagReads++; return ['Design', 'Research']; },
  save: async (_item, replace) => {
    window.sidebarFixture.saves++;
    if (window.sidebarFixture.mode === 'deferred-save') await new Promise<void>(resolve => { window.sidebarFixture.finishSave = resolve; });
    if (window.sidebarFixture.mode === 'save-error') throw Error('Fixture saving failed');
    if (window.sidebarFixture.mode.startsWith('duplicate')) {
      if (replace && window.sidebarFixture.mode === 'duplicate-error') throw Error('Fixture replacement failed');
      if (!replace) return { duplicate:{id:'existing',title:params.has('long-title')?'A long existing saved page title '.repeat(15):'Existing page',revision:'one'} };
      window.sidebarFixture.replacements=(window.sidebarFixture.replacements||0)+1;
      return {saved:true};
    }
  },
  close: () => { window.sidebarFixture.closes++; },
});
