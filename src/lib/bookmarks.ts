import type { StashItem, StashKind } from "../types";
import { normalizeFavicon } from "./siteIdentity";
import { canonicalReferenceUrl } from './reference-url.mjs';

export type BookmarkImportResult = {
  items: StashItem[];
  skipped: number;
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function canonicalizeUrl(value: string) {
  try {
    return canonicalReferenceUrl(value);
  } catch {
    return value.trim();
  }
}

function sourceName(url: URL) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const known: Record<string, string> = {
    "github.com": "GitHub",
    "x.com": "X",
    "twitter.com": "X",
    "reddit.com": "Reddit",
    "zhihu.com": "知乎",
    "xiaohongshu.com": "小红书",
    "youtube.com": "YouTube",
    "bilibili.com": "Bilibili",
  };
  return known[host] ?? host;
}

function bookmarkKind(url: URL): StashKind {
  if (url.hostname.replace(/^www\./, "") !== "github.com") return "web";
  const segments = url.pathname.split("/").filter(Boolean);
  return segments.length >= 2 ? "repo" : "web";
}

function bookmarkFolders(anchor: HTMLAnchorElement) {
  const folders: string[] = [];
  let current: Element | null = anchor.parentElement;

  while (current) {
    if (current.tagName === "DL") {
      let sibling = current.previousElementSibling;
      while (sibling && sibling.tagName !== "H3") sibling = sibling.previousElementSibling;
      const name = sibling?.textContent?.trim();
      if (name) folders.unshift(name);
    }
    current = current.parentElement;
  }

  return folders;
}

function bookmarkDate(raw: string | null) {
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function parseBrowserBookmarks(html: string): BookmarkImportResult {
  const document = new DOMParser().parseFromString(html, "text/html");
  const importedAt = new Date().toISOString();
  const seen = new Set<string>();
  const items: StashItem[] = [];
  let skipped = 0;

  for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    let parsed: URL;
    try {
      parsed = new URL(anchor.href);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("Unsupported URL");
    } catch {
      skipped += 1;
      continue;
    }

    const canonicalUrl = canonicalizeUrl(parsed.toString());
    if (seen.has(canonicalUrl)) {
      skipped += 1;
      continue;
    }
    seen.add(canonicalUrl);

    const folders = bookmarkFolders(anchor);
    const savedAt = bookmarkDate(anchor.getAttribute("add_date"));
    const icon = anchor.getAttribute("icon") ?? undefined;
    const faviconUrl = normalizeFavicon(icon, canonicalUrl);
    const title = anchor.textContent?.trim() || parsed.hostname.replace(/^www\./, "");

    items.push({
      id: `bookmark-${stableHash(canonicalUrl)}`,
      title,
      kind: bookmarkKind(parsed),
      source: sourceName(parsed),
      url: canonicalUrl,
      excerpt: folders.length ? `Saved in ${folders.join(" / ")}` : "Imported from browser bookmarks.",
      tags: folders.length ? [folders.at(-1)!] : [],
      createdAt: savedAt ?? importedAt,
      origin: {
        platform: "Browser bookmarks",
        importMethod: "bookmark_html",
        externalId: canonicalUrl,
        folderPath: folders,
        savedAt,
        faviconUrl,
        importedAt,
      },
    });
  }

  return { items, skipped };
}
