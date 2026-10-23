# Shared shelf UI verification

## Scope

One shelf session across folder, compact Dock and expanded Library; shared collection data remains in the existing repository store. No new state package or native window engine was introduced. Added the official free Arc ScrollArea via `npx shadcn@latest add @uiarc/scroll-area`; source and MIT notice remain under the existing Arc boundary. CopyForAI reuses Arc Button, and Sidebar uses the public shared-layout motion recipe, not a Pro block.

## Automated evidence

- TypeScript: `npx tsc -b`.
- Unit/contract tests: `npm run test:frontend`, **81 passed**, including library-session tests for shared state, reconciliation, feedback timers, coalesced refresh/failure recovery and stable card structure.
- Native backend regression: `npm run desktop:test`, **21 passed**. The existing SDK debug-PDB linker warnings remain non-fatal; no native code changes in this UI pass.
- `scripts/verify-shared-shelf.js`: isolated Tauri command fixture, 12 synthetic references. Small selects two, expanded removes one, small retains the correct ID; search/filter/refresh retained. Copy payload uses current selection; no AI launch. Clipboard rejection clears prior success. A delayed clipboard promise finishing after selection changes cannot acknowledge the new selection. Folder collapse/reopen retains selection. Native scroll viewport scrolls; platform bar is hidden. Gray navigation moves between rows and skips motion under reduced motion. Source favicon and external-link SVG are the identical DOM nodes across view switches. Stable success-button text contrast: **5.47:1** in light theme.
- `scripts/verify-card-refresh.js`: 320/390/768/1024/1440 widths, consistent grid heights, hover/focus/selected affordance, copy, multi-drag, quiet borders, favicon fallback, touch 44px targets, light-neutral/dark-blue rendering.
- `scripts/verify-arc-surfaces.js`: synthetic desktop-preview, embedded Dock and extension fixtures; imports, dialogs/focus, confirmation, clipboard, capture, disconnect/retry, responsive widths. The actual user's bookmarks/database are not mutated.
- `scripts/verify-window-controls.js`: seven expand/shrink cycles, original folder hover/close, neutral close, native-region rollback/watchdog, correct dialog placement/focus and no accidental native drag from control clicks.

Screenshots reviewed: `output/playwright/shared-shelf-dock.png`, `shared-shelf-library.png`, `shared-shelf-list.png`, plus card light/dark and narrow-layout screenshots. These use synthetic content.

## Arc review

- [x] Type/copy: sentence case, weights 400/500, token sizes, changing counts use tabular numerals, unified action names; no decorative eyebrow or em dash in new UI copy.
- [x] Color/surfaces: semantic tokens only; actual favicons retain brand colors; success has text/icon as well as color; cards have border rather than added shadow. Scoped success token is an explicit user-requested variation.
- [x] Layout: consistent gutters, image/title/footer geometry, concentric card radii, responsive widths and no sideways page overflow; compact spacing is the documented density variation.
- [x] Components: official free ScrollArea, existing Button/SearchField/SegmentedControl/Alert/Dialog. Documented public props; no reconstructed Pro source or restyled Button internals. Multiple card primary buttons are the user's explicit exception; redundant toolbar copy removed.
- [x] States: initial loading, empty, failed refresh/retry, failed clipboard, success, selected and long titles checked. Refresh does not replace existing content with skeletons or reset selections.
- [x] Motion: shared tokens, one highlight, stable DOM, reduced-motion branch, no per-frame React scroll updates. Official ScrollArea gradient masks are functional fades, not decorative gradients (main content uses fade=0).
- [x] React: new state factory is server-safe; desktop host is client-only. Stable item keys and one map for both views. Shared result cache avoids repeating FTS solely because shape changed.
- [x] Accessibility: named controls, real buttons/search/regions, keyboard focus exposes hover controls, selected controls persist, status not color-only, existing dialog focus/escape retained.
- [x] Responsive: specified widths plus 320px, touch 44px targets, both themes and neutral/blue checked.
- [x] Automated sweeps of changed business components: no new raw CSS colors, weights above 500, decorative gradients, uppercase transformations or custom focus rings. Native lint command is not configured; TypeScript and contract tests cover this project instead.

## Limits

Browser tests exercise the production React and transition code with isolated native commands, not actual Windows WebView2 pointer/clipboard delivery. They do not establish 60fps, mixed-monitor DPI correctness or acceptance by every third-party AI app. Chrome extension installation and real collection mutations were not used for tests. Root executable deployment and native build status must be checked separately.

## Windows release deployment

- `npm run desktop:build` succeeded, including TypeScript, Vite, optimized Rust executable, NSIS and post-build verification of all nine branded icon sizes. Existing SDK PDB warnings are non-fatal.
- Confirmed no running StashDock process before replacement, verified and backed up the old executable to `artifacts/stashdock-before-shared-shelf-20261008.exe`. Old SHA256: `C55471F4AEB4BB2167B4B041B411BF504129202538A0D2A823626D244E6208AB`.
- Updated `D:/StashDock/stashdock.exe`, identical to `artifacts/stashdock-shared-shelf.exe`. New SHA256: `D0C7799E87BC4436F4BCD59E2CBC6178839B74C0B030CCD953141C803245F6FA`.
- Installer preserved at `artifacts/StashDock_0.2.1_shared-shelf_x64-setup.exe`, SHA256 `04C784CA72F5FEB059E540C7A9EA2933945F42E9779BC29E36103E841E0EE6D3`.
- Started the updated root executable, PID 37516. Health and the newly built embedded frontend respond; read-only GET confirms **30 references / 16 previews**, unchanged from the prior release. Library operations during testing were isolated fixtures; no production collection mutation was used.
