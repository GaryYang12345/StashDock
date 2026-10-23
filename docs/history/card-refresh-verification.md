# Card refresh verification · 2026-10-08

## Implemented

- Image-first reference cards: 8px inset, concentric corners, 16:9 preview, two-line title slot, aligned source/visit/copy row. No visible time, tags or excerpt.
- Context selection at top left; favorite/delete at top right. Hidden at rest on fine-pointer devices, revealed by hover or focus. Selected context control stays visible. Touch controls stay visible with 44px targets.
- Selection does not change the card border. Search uses quiet grey semantic borders, not the foreground color. Shared Dock and extension selection surfaces follow the same rule.
- Shared site identity component: validated captured browser favicon, original-site fallback, then a readable initial. No external favicon proxy. Existing data stays intact.
- Extension 0.1.6 captures browser favIconUrl (or document icon metadata) alongside the screenshot. Re-saving an existing URL refreshes identity without replacing title, tags or other origin fields.
- Bookmark HTML ICON is stored as origin.faviconUrl, not a large screenshot. No backfill or mutation of existing user records.
- Removed ineffective grid LayoutGroup/AnimatePresence wrappers and obsolete compact tag styling. Folder artwork/window transition engine unchanged.

## Checks

- TypeScript check and production Vite build passed.
- 72 frontend tests passed; Rust library suite passed (19 tests). Existing linker warnings concern absent Microsoft PDB debug symbols, not runtime/build errors.
- `scripts/verify-card-refresh.js`: isolated fixtures, widths320/390/768/1024/1440, equal card heights, button containment, hover/focus, persistent selection, unchanged borders, single-copy payload, multi-select drag payload, favicon success/failure, touch, dark-blue and reduced-motion. No runtime page errors.
- `scripts/verify-arc-surfaces.js`: isolated import/link/bookmark, modal focus/Escape/return, confirmed deletion, shared Codex Dock, extension capture/bookmarks/copy error/disconnection/retry. Desktop data and installed Chrome extension are not mutated by these tests.
- Visual review: `output/playwright/card-refresh-{light,hover,list,dark,390}.png`.
- Read-only real library visual check:30 references/16 saved previews at1180px, a representative card419×359px, two columns with large screenshots. Snapshot: `output/playwright/card-refresh-real-library.png`. No collection writes.

## Arc review and explicit product exceptions

- [x] Semantic colors, token scale, 400/500 type, short copy, concentric radii, no ornamental shadows/gradients.
- [x] Stable title/action geometry, no horizontal overflow, named buttons, keyboard access, in-place copy feedback, image failure fallback, reduced motion.
- [x] Existing official Arc buttons/search/segmented controls/alerts remain in use; no Pro source or new UI dependency.
- [x] User-directed exceptions recorded in `ui-design-language.md`: image-toolbar business card composition, per-card black Copy action, optional SearchField border tokens.
- [x] New reference-card controls are36px for a mouse and44px on touch. Existing compact Dock/window/folder controls retain their documented desktop-specific density; this is a Windows-first desktop product, not a claim of a complete mobile redesign.
- [x] No lint task is configured; TypeScript, regression tests and targeted CSS/copy sweeps were run instead.

## Deployment

Replacement of the root executable and native visual smoke test require StashDock to be exited from the tray first. Do not overwrite a running application or claim the old process displays the new UI. Final executable/installer identity is recorded after the final build and safe replacement.

Final build succeeded; branded PE icon resources match at all nine sizes.

- Ready executable: `artifacts/stashdock-card-refresh.exe`, SHA256 `1E5323A9C80E73A516330B1641C8564E7DD8CDEB35B1CED61A8B6CF43F35A6A6`.
- Ready installer: `artifacts/StashDock_0.2.1_card-refresh_x64-setup.exe`, SHA256 `F3D4955F9FA05D9C71385F028F676D95F36ECB57852D029F7D6C753310450BB3`.
- After the user confirmed tray exit, verified no StashDock process remained. Backed up the old root executable to `artifacts/stashdock-before-card-refresh.exe` (SHA256 `85BD0EFE41EAD72A51C6CE0B5AD308EE669E69E328E95C2685EBD88C2884F953`).
- Replaced `D:/StashDock/stashdock.exe` with the verified ready executable (SHA256 `1E5323A9C80E73A516330B1641C8564E7DD8CDEB35B1CED61A8B6CF43F35A6A6`), then launched it. New PID56012 runs the root path. No forced termination, installer execution or data migration.
- Read-only bridge check:30 references/16 previews, health available. Native startup folder was visible; clicking its accessible Open StashDock control successfully opened the small Dock with real previews and site identities.
- Large-panel native smoke test remains incomplete: Computer Use rejected the Open full library click with `point (1499, 127) is over ChatGPT.exe "Chrome Legacy Window", not target window stashdock.exe "StashDock"`. Refreshed/activated the returned StashDock target and retried once; the same coordinate rejection remained. Stopped native input, did not bypass target protection. This is an automation targeting failure, not evidence that the app's resize button is broken. Prior isolated browser layout/action tests remain valid.
- Browser extension reload and refresh of an already-open Codex shelf are pending; no installed extension was altered. Final app was left open in the small Dock for manual inspection.
