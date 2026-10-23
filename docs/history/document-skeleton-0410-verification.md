# Document preview and collection selection, 0.4.10

## Changes

- Shared `PreviewArtwork` now uses the installed Arc Skeleton with five document lines (short heading, body lines, short final line). Cards at 260px or narrower use three lines to fit the unchanged 16:9 artwork. Only the visible variant is exposed to accessibility APIs. No visible loading caption remains.
- Loading remains tied to real queued/working preview jobs. Failed/unavailable jobs retain the normal fallback; loaded screenshots replace the skeleton without changing the artwork dimensions.
- Desktop and MCP collection regions have the same transparent Arc ghost `Select all` action at the top-right, aligned with the card grid. It remains available before selecting an individual card and selects all current filter matches.
- Both bottom selection bars omit Select all. The narrow MCP footer no longer needs the extra wrapping row or 128px bottom clearance introduced in 0.4.9.
- Selection across MCP pagination, bounded attachment batches and preservation of an existing draft are unchanged.

## Verification

- TypeScript check passed. Frontend suite: 173 passed, zero failures.
- `scripts/verify-preview-selection.js` passed: visible skeleton line counts, no loading caption, reduced motion, failure fallback, automatic screenshot replacement, transparent collection-right action, selection across 36 references, 30+6 test attachments and unchanged test draft.
- `scripts/verify-desktop-collection.js` passed against the actual `LibraryView` with isolated browser data: top-right placement, artwork containment, selection/clear, light-neutral and dark-blue themes at 320, 390, 768, 1024 and 1440px. No horizontal overflow.
- Screenshots inspected: `output/playwright/document-collection-light.png` and `output/playwright/preview-loading-two-column.png`. Dark layouts were also captured and geometrically checked.
- Existing hover/focus rules were left intact. Automated sweeps found no new raw colors, arbitrary typography, custom focus rings or decorative gradients. Project has no separate lint command.
- Windows release and NSIS packaging succeeded; all nine native icon sizes match the brand.
- The UI automation used isolated browser fixtures, not the real Codex composer or native Windows pointer gestures. Native backend code was unchanged in this release.

## Arc review

- [x] Find/install/wire: reuse existing free Skeleton and Button, documented props, no internal restyling or Pro source reconstruction.
- [x] Type/copy: concise English labels, sentence case, no ornamental loading copy or added overlines, token-based sizes/weights.
- [x] Color/surfaces: semantic tokens only; no new accent/status misuse, gradients, nested decorative cards or shadows.
- [x] Layout: existing single collection gutter, aligned card/toolbar edges, shared gaps, preserved concentric radii and 16:9 preview dimensions.
- [x] States: real loading/error/fallback/success preserved, all-selected disabled state and loading feedback retained.
- [x] Motion: existing finite staggered Arc pulse; reduced motion disables it. No new travel or layout animation.
- [x] React: no production first-render browser reads added; stable existing keys and reserved artwork dimensions retained.
- [x] Accessibility: one visible loading status per card, busy states, native buttons, no custom pointer rings; overlays untouched.
- [x] Responsive: both themes/two accents and all target widths checked. Dense desktop control sizing is retained; mobile touch interaction was not tested or changed by this desktop-focused task.

## Deployment

- Official plugin installation: `stashdock@personal` 0.4.10, resource `ui://stashdock/shelf-v12.html`. Fresh installed-server read-only smoke verification passed.
- Installed/source UI SHA256: `76C693C2234783D1D295DFFDFC2DBC513AAEC0BA333521FF8A212DC69E10A70D`.
- Installed/source server SHA256: `8C60C9CD56CF3375545E6CD3EAE0531ED426F2C31B8ED6FDCEF9E890B42143ED`.
- Stopped only verified root StashDock PID 43156 using the user's standing restart authorization. Installed and restarted `D:/StashDock/stashdock.exe`, new PID 40564; health endpoint reports ok.
- Installed/release EXE SHA256: `B9B4C7DB9E6E36ED353E46700CE3842F4803DFA34743522285779568F65DA30A`.
- NSIS SHA256: `200D527F4A1DED4906E4346BE6ADDB2C10334112AB8050037AB37CCDF62CBEAF`.
- Recoverable prior binary: `artifacts/stashdock-before-document-skeleton-20261011.exe`. Consistent SQLite backup: `artifacts/library-before-document-skeleton-20261011.sqlite3`.
- Before/after protected-content fingerprint matches for 32 references: `cad0b22a931f90aa6f6a4c523807f410124982d688db8e8013dc4bc33ff5ad20`. Pinned-tag fingerprint matches: `631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864`.
- Own test browser and development servers closed. Existing Codex conversations may retain the old MCP connection; a new conversation loads the new version/resource.
