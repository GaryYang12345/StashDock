# Single-page browser capture

Product decision: 2026-10-12. Platform-wide saved-collection imports and
independent sign-in browsers are retired. Ordinary browser bookmark imports
remain available. Archived connectors are not compiled or exposed as tools;
existing references and old session files are preserved, not reused.

## User flow

1. Desktop or Codex: **Import references → Import from → X / Xiaohongshu /
   Zhihu / WeChat → Open [site]**. Both hosts use the same Arc panel.
2. The site opens in the OS-default browser. Use the browser/profile where you
   normally sign in. StashDock does not launch or own another browser profile.
3. Open an individual article/post. Expand collapsed text, or select the text
   you want. In the extension, choose **Save current page**.
4. Save readable text, source metadata and a compressed screenshot locally.
   Synchronize to the common SQLite library when desktop or the Codex plugin
   is available. This captured text enters the canonical AI context.

The extension build currently targets Chrome/Edge. Safari/Firefox extension
packages are not shipped by this change; opening a platform in a browser is
not a claim that its extension is available there. Reload the unpacked extension
after updating to **0.3.0**. Reopen an already-open Codex panel to load its new UI.
No remote debugging, API key, paid X API or second sign-in environment is needed.

## Capture and data boundaries

- Generic articles use Mozilla Readability on a cloned document. Small adapters
  read individual X posts, Xiaohongshu notes, Zhihu articles/identified answers,
  WeChat articles. User selection is an explicit fallback.
- Only Save reads page bodies. Tab-change handlers read tab metadata, not text.
  No cookies, passwords, form drafts, hidden page state, authenticated request
  replay or platform writes. Website access remains the existing extension
  permission because its open side panel must capture the newly chosen tab.
- Captures contain visible text, not a complete conversation, unloaded comments,
  linked article bodies, audio/video transcripts or OCR. Text is bounded to
  20,000 code points; collapsed/truncated content is flagged. Unsupported or
  loading pages report an actionable error instead of saving metadata only.
- Check active tab, raw URL and navigation events around extraction and capture.
  A switch-away-and-back also aborts; screenshots cannot silently follow another
  tab. Compress to at most 720px wide, crop to the thumbnail aspect ratio and
  exclude the measured right scrollbar strip. This is a viewport screenshot,
  not a claim of full-page archival.
- Existing bookmarks may gain missing text and new imagery. Preserve user title,
  tags, favorites, existing body and final-context overrides (including an
  explicit empty override). Reindex filled text atomically in native and Node
  libraries. Offline captures are durable, with cross-window Web Locks protecting
  the outbox's read/modify/acknowledge transaction.
- Public pasted-link enrichment still uses the guarded public screenshot/PDF
  runtime. It does not borrow this browser's login or retired profiles.

## Verification evidence

- Frontend regression suite: **225 passed**. Includes platform fixtures, hidden
  roots, exact answer selection, navigation races, body preservation/FTS,
  permission errors, cross-window outbox serialization and retired-tool guards.
- Native tests: **87 passed, 1 ignored** across library, main and preview helper.
  Type checking, frontend/plugin builds and production packaging guard passed.
- Genuine extension injection and Chrome screenshot APIs passed in a CLI-owned
  isolated Chromium profile using an article fixture, not a signed-in account.
  The real Save handler persisted the article text and a **720 × 450** JPEG in
  the offline outbox. Requests to real library bridges were blocked.
- Shared desktop/Codex UI passed all five platform entries at 390, 768, 1024 and
  1440px, light/dark themes, two accents, reduced motion and Escape dismissal.
  Codex made 20 allowlisted open-site calls to the isolated fixture service and
  no retired connector calls. Screenshots: `output/playwright/capture-*.png`.
- Installed production desktop verified through its actual WebView, with Vite
  stopped: packaged `http://tauri.localhost` assets, shelf, all import tabs,
  single-page platform instructions, minimize and reopen. Temporary test debug
  access was removed; the installed app was restarted normally.
- Installed portable Codex plugin verified read-only; old platform tools are
  absent. Collection count remains 40. Core reference metadata/content matches
  the consistent backup at `artifacts/before-browser-capture-20261012`.

These are not authenticated platform acceptance results. Real signed-in DOM,
lazy loading, account challenges and future platform markup changes still need
per-platform checks. Adapters intentionally fail or request a selection when
they cannot identify the chosen post reliably.
