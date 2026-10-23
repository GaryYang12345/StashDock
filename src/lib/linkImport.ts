import { invoke, isTauri } from '@tauri-apps/api/core';
import type { StashItem } from '../types';
import { canonicalizeUrl } from './canonical-url';
import { openUrl } from '@tauri-apps/plugin-opener';
import { captureSites, customCapturePlatform, type CapturePlatform } from './captureSites';
import { prepareReferenceCover, type PrepareReferenceCover } from './referenceCover';
export type BrowserSource = {
    id: string;
    browser: string;
    profile: string;
};
export type BrowserBookmark = {
    title: string;
    url: string;
    folderPath: string[];
    savedAt?: string;
    faviconUrl?: string;
};
export type LinkPreview = {
    title: string;
    content: string;
    faviconUrl?: string;
    preview?: string;
    previewKind?: 'screenshot' | 'cover';
};
export const desktopLinkImport = {
    prepareCover: prepareReferenceCover,
    listCapturePlatforms: () => invoke<CapturePlatform[]>('list_capture_platforms'),
    saveCapturePlatform: (url: string) => invoke<CapturePlatform[]>('save_capture_platform', { url }),
    openCaptureSite: async (site: string) => {
        const values = [...captureSites, ...await invoke<CapturePlatform[]>('list_capture_platforms')];
        const value = values.find(value => value.id === site);
        if (!value) throw Error('This platform is no longer saved. Reopen the platform list.');
        await openUrl(customCapturePlatform(value.url).url);
    },
    available: isTauri,
    sources: () => invoke<BrowserSource[]>('list_browser_sources'),
    bookmarks: (sourceId: string) => invoke<BrowserBookmark[]>('read_browser_bookmarks', { sourceId }),
    icons: (urls: string[]) => invoke<Record<string, string>>('read_browser_bookmark_icons', { urls }),
    preview: (url: string) => invoke<LinkPreview>('preview_link', { url }),
};
export type LinkImportService = {
    prepareCover?: PrepareReferenceCover;
    openCaptureSite?: (site: string) => Promise<void>;
    listCapturePlatforms?: () => Promise<CapturePlatform[]>;
    saveCapturePlatform?: (url: string) => Promise<CapturePlatform[]>;
    available: () => boolean;
    sources: () => Promise<BrowserSource[]>;
    bookmarks: (sourceId: string) => Promise<BrowserBookmark[]>;
    preview: (url: string) => Promise<LinkPreview>;
    existingUrls?: () => Promise<string[]>;
    icons?: (urls: string[]) => Promise<Record<string, string>>;
};
export function normalizeLink(value: string) {
    const raw = value.trim();
    if (!raw)
        throw new Error('Enter a link to save.');
    const explicit = /^[a-z][a-z\d+.-]*:/i.test(raw);
    const url = new URL(explicit ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || (!explicit && !url.hostname.includes('.') && url.hostname !== 'localhost' && !url.hostname.startsWith('[')) || url.username || url.password)
        throw new Error('Use a complete http:// or https:// link without sign-in credentials.');
    return canonicalizeUrl(url.toString());
}
export function bookmarkCandidates(bookmarks: BrowserBookmark[], source: BrowserSource, existing: StashItem[]) {
    const saved = new Set(existing.flatMap(item => item.url ? [canonicalizeUrl(item.url)] : []));
    const seen = new Set<string>();
    const cached = new Map<string, string>();
    for (const item of bookmarks) {
        try { if (item.faviconUrl) cached.set(normalizeLink(item.url), item.faviconUrl); } catch { /* Skip invalid bookmarks. */ }
    }
    return bookmarks.flatMap(bookmark => {
        let url: string;
        try {
            url = normalizeLink(bookmark.url);
        }
        catch {
            return [];
        }
        if (seen.has(url))
            return [];
        seen.add(url);
        const faviconUrl = cached.get(url);
        return [{ ...bookmark, faviconUrl, url, key: url, saved: saved.has(url), browser: source.browser,
            origin: { platform: source.browser, importMethod: 'browser_bookmarks' as const, importedAt: '', faviconUrl } }];
    });
}
export function makeLink({ url, title, content, tags, faviconUrl, preview }: {
    url: string;
    title: string;
    content: string;
    tags: string[];
    faviconUrl?: string;
    preview?: string;
}): StashItem {
    const normalized = normalizeLink(url), parsed = new URL(normalized), now = new Date().toISOString();
    const host = parsed.hostname.replace(/^www\./, '');
    return { id: crypto.randomUUID(), title: title.trim() || host, kind: host === 'github.com' && parsed.pathname.split('/').filter(Boolean).length >= 2 ? 'repo' : 'web', source: host, url: normalized,
        excerpt: Array.from(content.trim().split(/\s+/).join(' ')).slice(0, 180).join(''), content: content.trim() || undefined, tags, createdAt: now, ...(preview ? { preview } : {}),
        origin: { platform: host, importMethod: 'manual_url', externalId: normalized, faviconUrl, importedAt: now, ...(preview ? { previewKind: 'screenshot' as const } : {}) } };
}
export function makeBrowserLinks(bookmarks: BrowserBookmark[], source: BrowserSource): StashItem[] {
    return bookmarks.map(bookmark => {
        const item = makeLink({ url: bookmark.url, title: bookmark.title, content: '', tags: [source.browser], faviconUrl: bookmark.faviconUrl });
        // Recent means added to StashDock. Preserve the browser's older date separately.
        return { ...item,
            origin: { ...item.origin!, platform: source.browser, importMethod: 'browser_bookmarks', folderPath: bookmark.folderPath, savedAt: bookmark.savedAt } };
    });
}

export const importCapacityError = (error: unknown) => /StashDock is busy|renderer is busy/i.test(String(error));
export async function readImportDetails(url: string, read: LinkImportService['preview'], current = () => true): Promise<LinkPreview> {
    const until = Date.now() + 45_000;
    while (current()) {
        try { return await read(url); }
        catch (error) {
            if (!importCapacityError(error) || Date.now() >= until) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw Error('Import cancelled.');
}

export function settleImportedLink(item: StashItem, details?: LinkPreview): StashItem {
    const content = details?.content?.trim() || '';
    return { ...item, content: content || undefined,
        excerpt: Array.from(content.split(/\s+/).join(' ')).slice(0, 180).join(''),
        ...(details?.preview ? { preview: details.preview } : {}),
        origin: { ...item.origin!, contentSettled: true,
            faviconUrl: item.origin?.faviconUrl || details?.faviconUrl,
            ...(details?.previewKind ? { previewKind: details.previewKind } : {}) } };
}
