import type { BrowserBookmark } from './linkImport';

export const bookmarkBrowsers = ['Chrome', 'Edge', 'Firefox', 'Safari'] as const;
const MAX_BYTES = 32 * 1024 * 1024;

/** Read only an explicitly selected Netscape bookmark export. DOMParser is inert. */
export function parseBookmarkHtml(html: string): BrowserBookmark[] {
    if (new TextEncoder().encode(html).length > MAX_BYTES)
        throw Error('Choose a bookmark HTML file smaller than 32 MB.');
    const document = new DOMParser().parseFromString(html, 'text/html');
    if (!document.querySelector('dl'))
        throw Error('Choose the HTML bookmark file exported by your browser.');
    const bookmarks: BrowserBookmark[] = [];
    function walk(element: Element, folders: string[], depth: number) {
        if (depth > 64) throw Error('This bookmark file has too many nested folders.');
        let path = folders;
        for (const child of element.children) {
            if (child.tagName === 'H3') {
                path = [...folders, child.textContent?.trim() || ''];
            } else if (child.tagName === 'A') {
                const raw = child.getAttribute('href') || '';
                try {
                    const url = new URL(raw);
                    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue;
                    const timestamp = Number(child.getAttribute('add_date'));
                    const date = timestamp > 0 ? new Date(timestamp * 1000) : null;
                    bookmarks.push({ title: child.textContent?.trim() || url.hostname, url: url.href,
                        folderPath: folders.filter(Boolean),
                        ...(date && Number.isFinite(date.getTime()) ? { savedAt: date.toISOString() } : {}) });
                    if (bookmarks.length > 50_000) throw Error('This bookmark collection is too large to read in one import.');
                } catch (reason) {
                    if (reason instanceof Error && reason.message.includes('too large')) throw reason;
                    // Invalid URLs and non-web bookmarks cannot become references.
                }
            } else if (['DL', 'DT', 'DD', 'P'].includes(child.tagName)) {
                walk(child, child.tagName === 'DL' ? path : folders, depth + 1);
            }
        }
    }
    for (const root of document.querySelectorAll('dl')) {
        if (!root.parentElement?.closest('dl')) walk(root, [], 0);
    }
    return bookmarks;
}

export async function readBookmarkFile(file: File): Promise<BrowserBookmark[]> {
    if (file.size > MAX_BYTES) throw Error('Choose a bookmark HTML file smaller than 32 MB.');
    if (!/\.html?$/i.test(file.name)) throw Error('Choose the HTML bookmark file exported by your browser.');
    return parseBookmarkHtml(await file.text());
}
