# Save-only popup and shared platforms — 2026-10-13

## Delivered behavior

- The extension toolbar opens a current-page draft, not a sidebar or collection browser. It automatically reads the active page and captures a bounded screenshot; title, content and tags are editable. Opening or dismissing the popup does not save a reference. Save closes only after a durable commit; failure keeps the form open.
- Desktop and Codex keep Chrome / Edge / Firefox bookmark import. Platform choices are one Arc AvatarGroup entry with brand-filled circles and an ellipsis. Its shared panel lists X, Xiaohongshu, Zhihu, Instagram, Reddit and LinkedIn, with Open actions and an Add platform dialog. WeChat and Weibo are absent.
- User-supplied `D:/Downloads/xhs.png` is the unchanged Xiaohongshu asset. SHA-256: `1913ef8549984a678409ddbf9d196d2db34fb8e78ce6b5487f91361c2ea94860`.
- Custom HTTP/HTTPS destinations persist in the same SQLite `app_meta.capture_platforms_v1` preference for both hosts. Saving is transactional and deduplicates canonical URLs. Credentials and non-web schemes are rejected; the list is bounded to 50 custom entries. Open uses the normal OS-default browser, without creating another profile or owning its lifetime.
- Old extension sidepanel/shelf rendering is removed. Existing extension queues and retired session data are retained. A background worker owns acknowledged saves and retries offline imports on later popup opens/saves.

## Arc review

Arc AvatarGroup, Avatar, fields, buttons, alerts, skeletons and ScrollArea are reused. The import dropdown has one optional rich-content slot inside its existing Arc item/highlight; no second menu implementation. Platform branding is limited to genuine image assets; the surrounding UI uses neutral semantic tokens. Shared ReferenceTagsField preserves the collapsed chooser, English copy and keyboard behavior. Save remains reachable when Chrome clamps popup height. Dialogs keep measured, interruptible height changes and reduced-motion support.

Reviewed: header/field alignment; button padding; icon sizes and contrast; group overflow; light/dark and narrow/wide bounds; loading/error states; Escape and focus; pending-action guards; explicit confirmation; persistent custom destinations; no hidden save, duplicated sidebar or per-host platform UI. Platform-list scrolling deliberately has no tag-style fading.

## Verification evidence

- TypeScript and production frontend build passed; 231/231 frontend tests passed. Native regressions: 89 passed, one clipboard integration test ignored as documented by its harness.
- `scripts/verify-browser-capture-ui.js`: eight rendered desktop/Codex cases (390, 768, 1024 and 1440px), light/dark, reduced motion, all six built-ins, invalid-scheme rejection, custom Save/reopen, dismissal and panel bounds. Codex exercised 28 Open tool calls through the real MCP SDK transport with an isolated database and fake browser launcher.
- Settled screenshots: `output/playwright/platforms-{desktop,codex}-{390,768,1024,1440}-{light,dark}.png` (theme depends on width).
- `scripts/verify-real-browser-capture.js`: genuine Chrome 155 toolbar popup in an owned test profile, not a navigated popup imitation. Verified activeTab-only automatic reading, no save before confirmation, edited title/content/tags, screenshot retention, durable offline save and automatic close. Windows Chrome clamped the viewport to 495×510 CSS pixels; Save bottom was 494px and no horizontal overflow occurred. The test worker/network were isolated from the user's library.
- Canonical extension assets check, release-mode packaging guard and all nine Windows icon sizes passed. The installed native WebView was checked with Vite stopped: packaged origin/scripts, shelf, all import tabs, Platforms and minimize/reopen.
- Consistent recovery snapshots: `artifacts/before-popup-platforms-20261013/` and `artifacts/before-popup-platforms-final-20261013/`. Deployment verifies executable, helper, server and UI hashes; it does not replace collection data. All three pre-upgrade/final-snapshot/installed library reads had 42 references and the same ordered-row SHA-256, `621bd4032846bba04948e54791383c5bae4ffb5c0a79b90720fcf2f03fbd4074`.
- Final installation acceptance passed again with Vite stopped. Native `list_capture_platforms` returned the existing empty preference, and panel Z-order was non-topmost. The app was then restarted normally without the temporary WebView debugging flag; test browsers and dev servers were closed.

## Activation and honest limits

Reload the unpacked extension in `chrome://extensions` / `edge://extensions` to activate 0.4.0. Reopen an existing Codex StashDock panel to load the new UI. No account login, remote-debugging setup or paid API is required by the product.

The new foreign entries are launchers, not a claim of full authenticated-platform adapters. They use generic article reading or explicitly selected text. X, Xiaohongshu and Zhihu have isolated post adapters validated against synthetic fixtures; actual signed-in platform acceptance was not performed in this change. Expand collapsed posts first. Hidden/unloaded text, comments and video/audio transcripts are not inferred. Chrome/Edge MV3 popup behavior was implemented; a Safari extension is not shipped.
