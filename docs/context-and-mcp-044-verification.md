# Final context and MCP App 0.4.4

## Changes

- Edit content opens the complete final Markdown, including the StashDock heading, card title, source, URL, import provenance and body. A nullable `context_override` stores manual snapshots independently of captured source text.
- Copy, browser/native file drag and MCP Add to chat share the same final-context semantics. Single-reference overrides remain verbatim, including whitespace, empty values and edits beyond 20,000 characters. Batch snapshots retain selection order and one standard outer heading. Unedited snapshots retain the existing desktop 20,000-code-point body limit; explicit saved overrides are not truncated again.
- Add to chat still submits resource-only draft attachments with `send: false`; it does not paste into or send the user's draft. Editor data and mutation tools are app-only. List results contain no captured body or override.
- MCP cards reuse the approved dashboard presentation, without screenshot tags. Three-dot menus contain Edit card and Edit content; right-click retains only Edit card. Image controls, star, selected check, screenshot zoom/lift, hover visibility, source favicon/open button and compact success action use shared components/tokens.
- Both card editors reuse the desktop Arc Tag Input/Textarea/Dialog wrappers. Existing tag suggestions remain visible after addition, commas remain text, the hint is “Press Enter to add a tag”, and successful saves close and restore focus.
- Tags sits beside the collection bar. Widths below 600px use one column, 600–999px two, and 1000px or wider three. The bar owns its own horizontal scrolling on narrow hosts; the page never scrolls sideways.
- Pointer/keyboard modality is shared with desktop. Bare Shift does not introduce a focus ring or reveal off-hover actions; genuine Tab navigation retains Arc focus feedback.

## Verification

- TypeScript build and frontend suite: 154 passing tests. Native suite: 40 passing tests. Windows release/installer build and branded-icon checks passed.
- Isolated MCP host, light/neutral and dark/blue: 320, 390, 600, 768, 1024 and 1440px verified 1/1/2/2/3/3 columns, same-row Tags and no page overflow. No page errors.
- UI verified final edited attachment text byte-for-byte, including a >20,000-character edit. Existing draft text remained unchanged. Confirmed metadata/content save-and-close, focus return, persistent suggestions, cancellation, hover after starring, right-click menu, Shift and Tab.
- Desktop isolated browser fixture verified complete initial content, exact copy after save, search/reload, cancellation, failed persistence retaining the draft, clearing and automatic close. Simulated native IPC/pane geometry verified command payload, editor bounds and unchanged folder position.
- Live composer delivery was not re-exercised: the test host is an isolated harness, not the actual Codex input box. No test references were added to the real conversation. Live screen-reader verification is unavailable.

## Arc review

- [x] Existing Arc items: Tag Input, Textarea, Input, Button, Dialog, Dropdown Menu, Segmented Control, Search Field, Scroll Area, Alert and Empty State. Foundation imported once; no vendor source fork.
- [x] Sentence case; clear action/error labels; no decorative helper copy, eyebrows, raw UI colors, added gradients, heavy weights or made-up font sizes.
- [x] Shared semantic surfaces, spacing, radii, status colors and icon sizes; preserved requested per-card actions and approved restrained hover lift.
- [x] Stable card identity, scoped async save/error state, reduced-motion branch, labelled controls, focus trapping/return, keyboard feedback and non-color-only success.
- [x] Narrow/wide and both themes checked. Touch targets inherit the existing coarse-pointer 44px rules. Global page overflow absent; collection overflow stays local.
- [x] Known external original-site favicon failures use existing fallbacks; no TLS bypass or network proxy. No lint script is configured; type check, automated token/source sweeps and tests are used.
- [ ] Live screen reader and actual-host draft delivery require separate acceptance; unavailable in this verification run.

## Recovery

SQLite recovery snapshot: `artifacts/library-before-context-044-20261010.sqlite3`.
Previous plugin: `artifacts/plugin-before-context-044-20261010`.
Only a nullable schema column was added to the actual library; 29 original records and pinned-tag fingerprints remained unchanged in the pre-deployment guard. Existing raw captured content and asset files were not overwritten by tests.

## Deployment and active-host limitation

- Official `codex plugin add stashdock@personal --json` installed 0.4.4. Installed/source HTML and stdio bundle hashes match. A fresh read-only stdio client confirmed version 0.4.4, `ui://stashdock/shelf-v6.html`, all final-context editor tools and 29 saved references, without edits.
- Windows EXE replaced only after verifying and stopping `D:/StashDock/stashdock.exe`. Recovery EXE: `artifacts/stashdock-before-final-context-044-20261010.exe`. Restarted exact EXE and confirmed `/v1/health`. Installed/release EXE SHA256: `24CB06C221801F29829B8FE67C5B28A25A9A4E79F3BC4C69ACEAB300DF26FFE3`.
- Post-restart normalized row fingerprint: `6b87c911ab24c5943b12ce18d693e9fd0f0414daad814af84ae48ae6cc683df5`; pinned fingerprint: `631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864`. These match the pre-upgrade SQLite snapshot; only a null added column is omitted when comparing legacy schemas.
- Opening StashDock from the already-active conversation still returned `ui://stashdock/shelf-v5.html`. Therefore this session retains the previous MCP connection; **current-host adoption is pending a Codex restart**. Codex was not killed or restarted. Installed-package/harness success is not claimed as current-host UI or composer acceptance.
- Own Playwright browser, Vite server and MCP fixture host were stopped. Recovery files and isolated test artifacts are retained.
