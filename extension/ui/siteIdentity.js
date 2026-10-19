// Use the site's own identity, never a third-party favicon proxy.
export function normalizeFavicon(raw, pageUrl) {
    if (typeof raw !== "string" || !raw.trim() || raw.length > 32768)
        return;
    if (/^data:image\/(?:png|jpeg|webp|gif|x-icon|vnd\.microsoft\.icon);base64,[a-z\d+/=]+$/i.test(raw))
        return raw;
    try {
        const url = new URL(raw, pageUrl);
        if (/^https?:$/.test(url.protocol) && !url.username && !url.password)
            return url.href;
    }
    catch { /* Invalid or privileged browser URLs are not image sources. */ }
}
export function faviconCandidates(item) {
    const saved = normalizeFavicon(item.origin?.faviconUrl, item.url);
    let fallbacks = [];
    try {
        const url = new URL(item.url || "");
        // Older imports have no browser metadata. Try a bounded set of same-origin
        // image paths, only after the preceding image fails. Never fetch page HTML.
        if (/^https?:$/.test(url.protocol) && !url.username && !url.password) {
            fallbacks = ["/favicon.ico", "/favicon.svg", "/favicon.png", "/apple-touch-icon.png"]
                .map(path => new URL(path, url).href);
        }
    }
    catch { /* Local references have no remote favicon. */ }
    return [...new Set([saved, ...fallbacks].filter((value) => Boolean(value)))];
}
export function siteLabel(item) {
    try {
        const url = new URL(item.url || "");
        if (/^https?:$/.test(url.protocol))
            return url.hostname.replace(/^www\./, "");
    }
    catch { /* Notes and files keep their source label. */ }
    return item.source;
}
