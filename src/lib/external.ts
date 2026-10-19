import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "codex:"]);

export async function openExternalUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error(`StashDock cannot open ${url.protocol} links.`);
  }

  if (isTauri()) {
    await openUrl(url.toString());
    return;
  }

  const opened = window.open(url.toString(), "_blank", "noopener,noreferrer");
  if (!opened) throw new Error("The browser blocked the new window.");
}
