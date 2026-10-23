export type IntegrationId = 'chrome' | 'edge' | 'firefox' | 'safari' | 'codex' | 'claude' | 'desktop';
export type IntegrationState = { id: IntegrationId; detected: boolean; version?: string };
export type IntegrationInfo = { items: IntegrationState[]; links?: Partial<Record<IntegrationId, string | null>>; githubUrl?: string | null };
export const browsers: IntegrationId[] = ['chrome', 'edge', 'firefox', 'safari'];
export const agents: IntegrationId[] = ['codex', 'claude'];
const browserPurpose = 'Save pages while you browse.';
export const referencePurpose = 'Browse your library and use references as context in conversations.';
const agentPurpose = referencePurpose;
export const integrationCatalog: Record<IntegrationId, { name: string; ready: boolean; purpose: string }> = {
  chrome: { name: 'Chrome', ready: true, purpose: browserPurpose },
  edge: { name: 'Edge', ready: true, purpose: browserPurpose },
  firefox: { name: 'Firefox', ready: true, purpose: browserPurpose },
  safari: { name: 'Safari', ready: false, purpose: browserPurpose },
  codex: { name: 'ChatGPT', ready: true, purpose: agentPurpose },
  claude: { name: 'Claude', ready: false, purpose: agentPurpose },
  desktop: { name: 'StashDock Desktop', ready: true, purpose: 'Browse and manage your references visually in a standalone desktop app. Bring them into any AI app.' },
};
export function applicationWebsite(id: IntegrationId): string | null {
  return (productLinks.applications as Record<string, { website: string | null }>)[id]?.website || null;
}
export function githubUrl(info: IntegrationInfo | null): string | null {
  try { const url = new URL(info?.githubUrl || ''); return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password && /^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname) ? url.href : null; } catch { return null; }
}
type IntegrationGuide = { title: string; description: string; steps: readonly string[] };
const browserGuide = (name: string): IntegrationGuide => ({
  title: `Save pages from ${name}`,
  description: 'Keep useful pages as references for future AI conversations.',
  steps: ['Open a page you want to save.', 'Click the StashDock extension to review its title and content.', 'Add tags if needed, then click Save page.'],
});
export const integrationGuides: Partial<Record<IntegrationId, IntegrationGuide>> = {
  chrome: browserGuide('Chrome'), edge: browserGuide('Edge'), firefox: browserGuide('Firefox'),
  codex: {
    title: 'Use references in ChatGPT',
    description: referencePurpose,
    steps: ['Open StashDock beside your conversation.', 'Add a reference directly, or select several.', 'Click Add to chat for your selection, then write your question.'],
  },
  desktop: {
    title: 'Use StashDock Desktop',
    description: referencePurpose,
    steps: ['Save links, write notes, or add files.', 'Organize references with tags and favorites.', 'Drag references into your AI app, or use Copy for AI and paste.'],
  },
};
export function installationUrl(info: IntegrationInfo | null, id: IntegrationId): string | null {
  const value = info?.links?.[id];
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
import productLinks from '../../../src-tauri/product-links.json';
