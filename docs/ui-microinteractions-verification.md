# UI microinteractions verification

## Implementation

- Cards retain their existing drag payloads, without on-card GripVertical. The multi-selection bar remains the only visual drag grip.
- Sidebar has one persistent indicator per navigation list. Arc ghost buttons receive a scoped transparent hover token, so a second gray destination is not painted while the indicator travels. Positions use layout coordinates rather than transformed native-canvas bounds. Smooth spring has zero bounce. A live media-query subscription handles reduced motion, including changes during the session.
- All tags are reachable in the official Arc ScrollArea, not just the first seven. No per-frame React scrolling work was introduced.
- Compact select and copy actions share 36px square geometry, with 44px touch targets. Text CopyForAI uses Arc Button's existing intrinsic-width spring. Clipboard writes happen immediately. A short busy acknowledgement starts after React commits, including repeat clicks while Copied is shown; timers are cleaned on unmount. Actual failure and selection-change guards remain in the shared controller.
- Native hover title attributes were removed from business controls and truncated text. One product tooltip adapter and semantic stylesheet are shared with the plain-HTML extension through the existing asset sync. It uses Arc timing/easing, keyboard descriptions, Escape dismissal, hoverable content, collision bounds and cleanup. Tooltip events are delegated, not installed per card.
- Modal hints stay in the modal's accessible DOM subtree and use the browser's manual top layer where supported, avoiding inherited entrance transforms and clipping. The adapter does not add modal/light-dismiss behavior; it cancels delayed hints for hidden panes and does not swallow Escape for an invisible hint. Continuous scroll cannot restart the fade-out. [Popover API behavior](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using).
- The official free Arc Tooltip was reviewed via its documentation and registry source. Its content/side API cannot supply a clipped Windows surface boundary or the browser extension's native dialog host. The product adapter is the explicit compatibility exception; no official source or Pro component was modified/reconstructed, and the unused trial dependency was removed.
- Native window region, lifecycle, dragging, collection schema, capture and MCP protocols are unchanged. Browser-extension copy wording now also reads Copy for AI.

## Browser evidence

All collections, clipboard and native commands below are isolated fixtures. No real references or Chrome bookmarks are changed.

Automated checks: `npx tsc -b` passed; `node --test --test-reporter=dot tests/*.test.mjs` **88 passed**; `npm run desktop:test` **21 passed**. There is no configured lint command. Existing Windows SDK debug-PDB linker warnings are non-fatal.

- `verify-ui-microinteractions.js`: no card grips; equal aligned 36px compact buttons; copy width **125.19px → 97.80px**; repeat clipboard writes with a visible busy acknowledgement; 36 reachable tags and overlay scrollbar; sampled indicator positions along its actual path; stable indicator DOM, rapid reversal, no duplicate hover fill, live reduced-motion update; black tooltip bounds inside folder/Dock/library; Escape closes hint without collapsing pane; no native title attributes.
- The targeted run also checks tooltip fade during continuous scrolling, and accessible hosting/bounds/Escape inside the React import dialog. Tooltips are not placed in the modal's aria-hidden outside subtree.
- `verify-shared-shelf.js`: shared selections, queries and filters across folder/Dock/library; refresh retains selection; failed clipboard clears success; stale asynchronous copy cannot acknowledge a changed selection; shared drag payload; stable favicon/open SVG across grid/list. Measured stable success-text contrast **5.47:1** in the final synthetic light-theme run.
- `verify-card-refresh.js`: 320, 390, 768, 1024 and 1440px; no horizontal overflow, equal grid heights, hover and keyboard actions, multi-selection drag, quiet selection borders, favicon fallback, 44px touch targets, light-neutral and dark-blue screenshots.
- `verify-arc-surfaces.js`: preview/library, embedded Dock and extension widths; import and delete confirmation flows, focus return, copy success/failure, simulated capture and disconnect/retry. Extended to check the shared black extension tooltip and correct hosting inside a native HTML dialog.
- `verify-window-controls.js`: final frozen-source run passed seven expand/shrink cycles, attached folder close during hover, neutral close feedback, region failure/watchdog recovery, current-pane dialog placement and focus return, no accidental native drag from controls, and three hide calls. Page-error collection was empty. Its asynchronous pane predicates now wait for lazy-mounted elements instead of dereferencing a missing element; this fixes a test race without weakening the final-state assertions.

Screenshots: `output/playwright/ui-microinteractions-folder-tooltip.png`, `ui-microinteractions-dock.png`, `ui-microinteractions-library.png`; existing shared-shelf and card/theme screenshots are also reviewed.

## Arc review

- [x] Type/copy: sentence case, no decorative eyebrow/em dash, weights400/500, token text sizes, accessible action names and tabular counts. User reference text stays unchanged.
- [x] Color/surfaces: semantic tokens; black/white tooltip roles map to the foundation monochrome ramp intentionally in both themes. Real success uses text/icon and color. No new decorative gradients or card shadows; approved folder artwork remains untouched.
- [x] Layout: equal compact action geometry, full card alignment and responsive widths verified; count badges remain quiet, tags do not overflow their column.
- [x] Components: existing official free Arc Button/ScrollArea/SearchField/SegmentedControl/Alert/Dialog, documented props, no rewritten vendor internals or reconstructed Pro source. Per-card primary copies and native-compatible tooltip adapter are explicit product exceptions.
- [x] States: loading, empty, error/retry, copy success/failure/repeat, long titles and retained selection checked; refreshing does not replace content or clear selected IDs.
- [x] Motion: shared tokens, persistent indicator, zero-bounce selection motion, spring width morph, live reduced-motion navigation and no per-frame native/React scroll writes.
- [x] React: stable indicator/button/item identity, client effects for tooltip installation and media preferences; feedback timers unsubscribe on unmount. No data-store refactor.
- [x] Accessibility: native semantic controls, specific labels, keyboard hints/descriptions and Escape, hover/focus parity, dialog focus and return preserved; overlay inside folder cannot steal its click.
- [x] Responsive/themes: specified widths plus320px, touch targets, both themes and neutral/blue accents covered by browser fixtures.
- [x] Automated sweeps: no new raw CSS colors, >500 weights, uppercase, decorative gradient or custom focus-ring patches in changed business styles. Project has no configured lint command; TypeScript and contract tests are used.

## Limits

These browser checks run real React/extension code with mocked Windows commands and clipboard. They do not verify physical Windows WebView2 pointer delivery, real OS clipboard integration, mixed-monitor DPI, 60fps, or real installed-extension permissions. Native executable compilation and branded icon checks are separate. Chrome toolbar tooltips and the Windows tray/menu are system-owned UI, not webpage components.

## Release

- Final native build and all nine branded icon sizes passed. Existing Windows SDK PDB warnings remain non-fatal.
- Root executable and `artifacts/stashdock-ui-microinteractions.exe`: SHA256 `668CA0EADCB41FFA1ACB27915301115CB44124387033E6ADD1753A606D31DBB3`.
- Installer `artifacts/StashDock_0.2.1_ui-microinteractions_x64-setup.exe`: SHA256 `49A9A95437BCA1CD3EFBBFB14A4FB5CA9AA843504C5B738432423C3612184CDD`.
- Previous root executable preserved in `artifacts/stashdock-before-ui-microinteractions-20261009-015442.exe`, SHA256 `D0C7799E87BC4436F4BCD59E2CBC6178839B74C0B030CCD953141C803245F6FA`. No running StashDock process was terminated; process absence and backup hash were checked before replacement.
- Updated root executable started successfully. Read-only health check returned `ok: true`, `name: StashDock`, `apiVersion: 1`; port17863 belongs to the new root process. `/dock?surface=codex` serves final bundle `/assets/index-rBeCoHdD.js`. Real collections were only read for counts, not mutated.
- Reload the unpacked browser extension in Chrome to activate its synchronized tooltip assets. Refresh the Codex embedded Dock to replace its already-loaded page bundle. Real Windows pointer/clipboard integration remains outside these browser-fixture checks.
