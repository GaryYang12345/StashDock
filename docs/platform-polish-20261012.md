# Platform import and browser shelf consistency — 2026-10-12

## Changes

- The shared import menu identifies X, Xiaohongshu, Zhihu and WeChat with
  source marks. Browser and platform marks have matching square dimensions:
  17px within Arc's menu icon slot, 20px in panel headings.
- The shared platform panel uses a source icon/name heading and one instruction.
  Red, blue and green brand navigation actions retain Arc's geometry, focus,
  loading and pressed states. X retains the existing neutral primary action.
  White labels use deeper brand shades for readable interaction states.
- Weibo was removed from the source allowlist, MCP schema, extension adapter
  and identified-platform labeling. Generic public-page saving remains available.
- Only the collapsed folder is topmost. Every mode transition updates the
  native policy; a failed transition restores the previous policy. Tray restore
  does not replace that policy or continuously raise the window.
- Browser shelf cards directly reuse ReferenceCardView, menus, ReferenceEditor
  and the shared destructive dialog. Includes previews, favicons, external visit,
  favorites and title/tags editing; excludes context selection, content editing
  and AI copying. The existing current-page capture and bookmark-folder import
  remain available; bulk tag entry and redundant bookmark copy were removed.
- Offline card edits use the existing Web-Locks-protected durable outbox.
  Imports resolve before edits; edits target the canonical shared reference ID.
  The native and MCP bridges accept only title/tags or favorite changes, never
  arbitrary content or file paths. Captured bodies and user context overrides
  are preserved. Extension version is 0.3.1.

## Verification

- TypeScript and production desktop/Codex builds passed; Arc-generated extension
  assets match their canonical sources and bundled dependency notices are included.
- Frontend regressions: 229 passed. Native regressions: 88 passed, one clipboard
  test intentionally ignored because it overwrites the OS clipboard.
- Both import hosts tested at 390/768/1024/1440px, light/dark, blue/violet,
  including reduced motion. Checked all four sources, matching loaded menu icons,
  brand action colors, absence of Weibo/redundant copy, boundaries and Escape.
  Codex used the current shared platform-opening tool for all 16 fixture actions.
- Real unpacked Chrome extension tested in an isolated CLI-owned profile,
  with loopback bridges blocked to prevent writes to the real collection.
  Save captured real article text and a 720×450 screenshot, retained offline.
  Shared metadata editor, favorite, external visit, delete/keep dialog, offline
  durability and horizontal overflow checked at all four widths and both themes.
  This is browser integration and synthetic article acceptance, not real signed-in
  platform extraction acceptance; no account or login challenge was exercised.
- Installed desktop checked with development servers stopped: packaged
  tauri.localhost assets, shelf, Link/Note/File tabs, new X panel, collapse/reopen.
  Read actual Win32 WS_EX_TOPMOST: panel=false, folder=true, panel=false.
- Production custom-protocol packaging guard and all nine native brand icon
  sizes verified. Desktop and Codex installed artifacts match build hashes.

## Recovery and activation

Fresh consistent SQLite, desktop and Codex plugin recovery copies are in
`artifacts/before-platform-polish-20261012/`. The user database and retired
platform session files were not replaced. Reopen an existing Codex shelf to
load the new UI. Reload the unpacked extension in chrome://extensions or
edge://extensions and reopen its side panel to activate version 0.3.1.

Post-install read-only comparison: all 42 reference core metadata rows match
the fresh pre-upgrade backup. The desktop was restarted normally without debug
arguments; its expanded window remains non-topmost. Owned test browsers and
development servers were closed; debug port 18749 is no longer listening.
