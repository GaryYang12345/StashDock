import type { App } from '@modelcontextprotocol/ext-apps';
import type { BrowserBookmark, BrowserSource, LinkImportService, LinkPreview } from '../../lib/linkImport';
import { customCapturePlatform, type CapturePlatform } from '../../lib/captureSites';
import { readReferenceCover } from '../../lib/referenceCover';

// Only this adapter differs by host. The form and its import logic are shared.
export function mcpLinkImport(getApp: () => App | null): LinkImportService {
  async function read(name: string, args: Record<string, unknown> = {}) {
    const app = getApp();
    if (!app) throw new Error('The MCP App is not connected. Retry the connection.');
    const result = await app.callServerTool({ name, arguments: args }, { timeout: name === 'preview_stashdock_link' ? 120_000 : 30_000 });
    if (result.isError) throw new Error(result.content.find(block => block.type === 'text')?.text || 'The import could not be read. Retry.');
    return result._meta;
  }
  async function platforms(name: string, args: Record<string, unknown> = {}): Promise<CapturePlatform[]> {
    const values = (await read(name, args))?.platforms;
    if (!Array.isArray(values) || values.length > 50 || values.some(value => !value || typeof value.url !== 'string' || typeof value.id !== 'string'))
      throw Error('Saved platforms could not be read. Reopen the platform list and retry.');
    return values.map(value => {
      const normalized = customCapturePlatform(value.url);
      if (normalized.id !== value.id) throw Error('Saved platforms contain an invalid destination.');
      return normalized;
    });
  }
  return {
    prepareCover: async file => {
      const value = (await read('prepare_stashdock_cover', { base64: await readReferenceCover(file) }))?.preview;
      if (typeof value !== 'string' || value.length > 750_000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw Error('The cover could not be prepared. Choose another image.');
      return value;
    },
    listCapturePlatforms: () => platforms('list_stashdock_capture_platforms'),
    saveCapturePlatform: url => platforms('save_stashdock_capture_platform', { url }),
    openCaptureSite: async site => { await read('open_stashdock_capture_site', { site }); },
    available: () => Boolean(getApp()),
    icons: async urls => {
      const values = (await read('read_stashdock_bookmark_icons', { urls }))?.icons;
      if (!values || typeof values !== 'object' || Array.isArray(values)) return {};
      return Object.fromEntries(Object.entries(values).filter((entry): entry is [string, string] => urls.includes(entry[0]) && typeof entry[1] === 'string'));
    },
    sources: async () => {
      const values = (await read('list_stashdock_import_sources'))?.sources;
      if (!Array.isArray(values) || values.some(value => !value || typeof value.id !== 'string' || !['Chrome', 'Edge', 'Firefox'].includes(value.browser) || typeof value.profile !== 'string')) throw new Error('Browser sources could not be read. Retry.');
      return values as BrowserSource[];
    },
    existingUrls: async () => {
      const values = (await read('list_stashdock_import_sources'))?.existingUrls;
      if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) throw new Error('Saved links could not be checked. Retry.');
      return values as string[];
    },
    bookmarks: async sourceId => {
      const values = (await read('read_stashdock_browser_bookmarks', { sourceId }))?.bookmarks;
      if (!Array.isArray(values) || values.some(value => !value || typeof value.title !== 'string' || typeof value.url !== 'string' || !Array.isArray(value.folderPath))) throw new Error('Bookmarks could not be read. Retry.');
      return values as BrowserBookmark[];
    },
    preview: async url => {
      const value = (await read('preview_stashdock_link', { url }))?.preview;
      if (!value || typeof value !== 'object' || typeof (value as LinkPreview).title !== 'string' || typeof (value as LinkPreview).content !== 'string') throw new Error('Page details could not be read. Enter them manually.');
      return value as LinkPreview;
    },
  };
}
