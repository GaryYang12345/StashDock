# Tags and document lookup, 0.4.16

## Changes

- The shared Tags field puts Choose tags beside its label, without adding a row. Clicking the input still does not open suggestions.
- The popover is portalled inside the active visible desktop pane. Radix collision detection uses that pane rather than the larger transparent native window. The suggestions have one height-bounded scroll area.
- PDF responses are identified by their media type or binary signature before applying the HTML budget. PDF.js 6.4.299 is bundled, not downloaded on first use. PDF links yield metadata, up to 50,000 characters of text, and a raster of the actual first page. The bounded PDF download budget is 32 MiB.
- Both the desktop and packaged MCP helper use the same document reader. Saved previews persist through the shared import form.
- Public requests try another validated DNS endpoint after connection or body-read failures, within an absolute deadline. No private-network, proxy, certificate-validation, or browser-login bypass was introduced.

## Evidence

- Frontend: 188 tests passed; TypeScript build passed.
- Native Rust tests passed, including PDF detection and network/renderer isolation; the release helper and desktop installer built successfully.
- Shared form: five widths, direct typing, explicit expansion, retained suggestions, Escape/focus return, successful save closing the dialog.
- Native geometry fixture: a 0.9-scaled visible pane inside a larger transparent-window canvas. The last of 83 tags remains scrollable and the popover stays inside the pane. This is a browser simulation of native geometry, not a screenshot from the production HWND.
- Actual arXiv PDF: https://arxiv.org/pdf/2505.22954 returns a 3,825,399-byte PDF. Title and 50,000 text characters were extracted; the real first-page JPEG was visually inspected.
- The actual packaged MCP lookup also returned the PDF title, 50,000 characters and a 75,227-character JPEG data URL. An isolated packaged background-worker test reached `working` then `ready`, without a desktop process or system browser, and preserved all fixture content/tags/favorite values.
- Packaged MCP import UI: twenty theme/accent/width combinations passed, including label-row placement, Link/Note/File inputs, browser import, existing-tag selection and responsive one/two/three-card columns. Browser profile and lookup data in these UI tests are simulated.
- SpektraLab: https://spektralab.app/ succeeded in an earlier public read, but subsequent independent system HTTP, curl, Node, Chromium, and native reads also timed out or were disconnected. The lookup is not asserted to always succeed. Manual fields remain available when the network/site cannot deliver the page.
- All mutation tests use isolated fixture databases. The 33-reference user library's content and pinned-tag hashes remain unchanged.
- Deployed plugin: 0.4.16, `ui://stashdock/shelf-v18.html`. Desktop executable replaced and restarted after a consistent SQLite backup and executable backup; the installer is `src-tauri/target/release/bundle/nsis/StashDock_0.2.1_x64-setup.exe`.

## Arc review

The changed field composes the existing Arc TagInput, Button, Input, ScrollArea and Popover styles. The native portal/collision adapter uses Radix's documented props, without copying or modifying Arc component internals.

Type and copy

- [x] Sentence case; no uppercase transforms, eyebrow, overline or decorative punctuation.
- [x] Existing 400/500 type weights and text tokens; named actions and actionable errors.
- [x] No changing numbers were introduced.

Color and surfaces

- [x] Semantic tokens only; existing selected/status semantics retained.
- [x] No new gradients, glows, colored shadows, logo recoloring, icon tiles or decorative cards.
- [x] Existing floating-layer shadow and card borders retained.

Layout and components

- [x] Shared field layout, no extra gutter or suggestion row when collapsed.
- [x] Existing page/card alignment and concentric radii retained.
- [x] Token spacing and bounded internal scrolling; no sideways page scroll.
- [x] Existing Arc components, documented composition and one primary action per dialog; no Pro source reconstructed.

States, motion and React

- [x] Existing loading, empty, error/retry, success and disabled behavior tested.
- [x] Long tags truncate with a full-value title; searchable suggestions remain bounded.
- [x] No custom animation added; Arc motion and reduced-motion behavior retained.
- [x] No render-time browser access added; host detection occurs on an interaction.
- [x] Stable suggestion keys and no reserved-height expansion on first render.

Accessibility and responsive behavior

- [x] Existing Arc keyboard focus indicators, labels, real buttons and specific names retained.
- [x] Escape and focus return tested; dialog focus containment retained.
- [x] Selection is indicated by a check as well as color.
- [x] 320, 390, 768, 1024 and 1440 widths tested; coarse-pointer control sizing retained.
- [x] Light/dark themes, neutral/blue accents and reduced-motion mode tested in the shared form regression.
