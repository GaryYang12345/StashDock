# Stage review and optimization: 2026-10-16

## Scope and recovery

Manually triggered by the user. Preserve approved UI, image choice C, the
simple native folder/panel lifecycle and the single authoritative library.

Recovery snapshot: `artifacts/phase-check-20261016-before`. It contains 821
source files, preceding build/install artifacts and a consistent 46-reference
SQLite backup. No backup was restored over live data. Removed sources remain
recoverable there; collection, assets, profiles and licensing notices were kept.

## Changes and ownership

- Removed the browser Settings entry/view/export, standalone setup HTML/JS,
  automatic first-install setup tab, browser-only integration composition and
  its app-launch RPC. Desktop/AI-host Settings and their launch actions remain.
- Save sidebar imports the existing shared product control policy. Icon-only
  controls use equal dimensions and circular hover/pressed fills; labelled
  controls retain Arc's shape. Existing Arc fields, alerts, tags and tooltips
  remain the presentation owners, not duplicated browser implementations.
- Missing-provider recovery stays inline with Check again. Visible-only,
  bounded health requests are separate from toolbar/startup installation
  registration, avoiding periodic installation scans and registration writes.
  Provider requests use the same extension/window/client authorization as reads.
- Fixed a confirmed lifecycle bug: closing the sidebar during Save invalidated
  its generation, and Save's finally block then started a new read after
  unmount. Mounted guards now prevent that. Navigation during a live commit
  still recaptures correctly and cannot inherit stale Saved feedback.
- Page teardown now unmounts the form and disposes transport, tooltip, media
  and visibility listeners through one owner.
- Tag reads no longer unconditionally synchronize/download the full library
  and screenshots. Recovery runs only when the durable outbox actually has
  pending operations. Legacy pending edits/deletes remain recoverable.
- Removed unused Lucide components from file classification. Classification
  returns metadata; ReferenceGlyph remains the single colorful icon renderer.
  Image stays the selected upstream blue image-file asset and blue cover tint.

Browser entry JS decreased from 564,320 to 504,751 bytes: 59,569 bytes (10.6%).
This is a bundle-size measurement, not a claim of equivalent runtime speedup.

## Review and verification

- 295 frontend tests passed, including new health-only discovery, no-settings,
  pending-only recovery and no-full-library-fetch regressions. TypeScript and
  extension generated-asset parity passed. No separate lint script is defined.
- Native tests: 99 library/window/transfer tests, 2 independent-startup tests,
  24 preview-helper tests and 4 storage-helper tests passed (129 total). The
  clipboard-writing test remains intentionally ignored to preserve the user's
  clipboard. No native lifecycle implementation changed.
- Ten browser form render checks cover light/dark, neutral/blue and widths
  320/390/768/1024/1440. Refresh is 36 by 36 with 50% radius; missing-provider
  recovery retains edited fields, Save confirms without closing, no overflow.
  Deferred-Save unmount and navigation regressions passed with zero page errors.
- Real unpacked extension in an owned persistent Chromium profile completed
  30 same-origin navigations with the same sidebar target. Late hydration,
  preservation of edited title/content, an actual worker stop/restart and
  observation after restart passed. No toolbar re-click or sidebar reopening.
  Same-origin synthetic pages use activeTab; no broad website permission was
  granted by automation. The initial cross-origin run lacked optional access
  and was not treated as a product pass or worked around by granting it.
- Desktop integration fixture: six marks, planned rows, guide/Escape/focus and
  ten theme/width combinations passed. Packaged MCP SDK harness: browser/desktop
  sections, no competitor rows, icons, guide actions, focus return, circular
  dialog controls and five widths passed. The fixture's old relocated database
  correctly refused direct writes; its isolated preferences were reset through
  the library adapter, never by removing guards or touching real preferences.
- Sixteen shared dashboard/packaged-MCP render checks cover grid/list, visible
  icon-only circle geometry, 390/768/1024/1440 and both themes. Zero page errors.
  Browser screenshots were inspected; static fixture favicon 404 is unrelated
  to application execution.
- Production Desktop and portable MCP builds passed. Desktop release enables
  tauri/custom-protocol; the installed executable contains index-OUt8veZ4.js.
  Actual native panel opened packaged assets and repeated folder/panel switching
  retained the panel layout and visible folder. Windows brand icon parity passed.
- Installed MCP HTML/server match the source builds byte-for-byte. Read-only
  installed SDK smoke passed with shelf-v46 and app-only mutation boundaries.

Build warnings: existing MSVC missing-debug-PDB linker warnings, two native
test-helper dead-code warnings and upstream Rollup annotation warnings remain.
They did not prevent successful builds; this review does not hide them as fixes.

## Deployment and data

Browser: 0.4.11 in `D:/StashDock/extension`; reload the unpacked extension once.
Desktop: `D:/StashDock/stashdock.exe`, SHA-256:
`969e244e61a3b47837d7587f672c8696365a41fe2a90d2b90e691c0bd036c744`.
MCP: installed cache 0.4.27, resource `ui://stashdock/shelf-v46.html`.
Existing AI tasks can retain an older resource/server until reconnection.

Reference count remains 46. Canonical reference-row SHA-256 remains
`a07ff65b8ed740ecf8fbc95c7e308c31147fd4c25ce5625fd9ccf35720d8c8a0`.

## Findings deliberately not rewritten

Shared queued mutations, canonical URL/tag identity, reconciliation, bounded
preview reservations, failure retry and independent native-window ownership
were reviewed against their regressions. No confirmed defect justified another
architecture rewrite. The legacy HTTP app-launch route remains available for
older compatible clients; only its retired browser UI caller was removed.

Large-library virtualization/compact bridge projection remain measured future
work, not a speculative protocol change. MCP shelf/SQL module splitting should
follow real responsibilities, not line counts. Signed-in platform completeness,
cross-origin optional-permission acceptance in the daily browser, mixed-DPI
physical monitors and non-Windows packages were not newly certified. Passing
tests do not prove the absence of every bug. Custom folder motion stays deferred.

Arc review: existing components, semantic tokens, professional concise recovery
copy, keyboard/focus, reduced motion, both themes and responsive layouts retained.
The circular icon-only shape is the explicit StashDock variant. Settings removal
reduces the Save surface to its one task rather than introducing another screen.
