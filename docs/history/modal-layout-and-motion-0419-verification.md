# Modal layout and motion — 0.4.19

## Findings and changes

- The import modal used fit-content sizing for three progressively populated panels. Swapping those panels also moved the centered modal and its selector. The shared import surface now reserves a stable, bounded height; only the selected Arc highlight moves. Header/type selector remain fixed while unusually long forms scroll inside their panel, with the save action kept reachable.
- The selector combined unequal intrinsic trigger widths with an inline-flex label baseline. Layout-only trigger widths are now equal (96px) and each business icon/text wrapper is a centered flex group. Arc Tabs source and semantics are unchanged.
- All active desktop/Codex dialogs share `FluidDialog`. Import no longer has its own reduced header gutter: header/body use Arc's 24px padding, 16px on narrow browser surfaces. Typography uses the Arc title scale/tracking, and the close button centers on the first title line rather than stretching the header by its control height.
- Existing-tag choices no longer receive a scroll fade, which was masking parts of interactive chips. They keep the Arc scroll area and collision-aware popover, preferring the space above the lower form trigger. Sidebar navigation fading is unchanged.
- File selection/save, context payloads, collection records and native behavior were not changed. Redundant filename separator padding was removed so a normally populated file form fits the same stable import surface.

## Checks performed

- TypeScript build and 196 frontend/server regressions passed.
- Desktop modal header sweep: 40 combinations (five active edit/confirmation dialogs, two themes, four widths), plus all five dialogs within the scaled native pane.
- Import geometry: 48 samples during rapid Link/Note/File switches, no height or position changes; all three labels centered within <1px; title gutter 24px excluding the border; first-line close alignment <1px.
- Normal file panel measured `clientHeight = scrollHeight = 466px`; no internal scroll needed.
- Existing-tag tests passed 320/390/768/1024/1440 widths, scaled native collision bounds, focus return, keyboard Escape and retained selected suggestions. Computed tag-region mask is `none`, including while scrolling.
- Multiple-file editing, selection-not-save and explicit save/close regression passed.
- MCP modal sweep: 25 checks, all six active dialogs across sidebar/fullscreen and light/dark; bounded import height also checked with reduced motion.
- MCP full import regression passed 20 theme/accent/width combinations, including manual links, browser import, staged files and notes; test draft unchanged.
- Official Arc source internals were not changed; only documented class/native props and the shared host adapter/layout were adjusted.
- Built/installed MCP 0.4.19, resource `ui://stashdock/shelf-v21.html`; installed read-only protocol smoke passed.
- Deployed and restarted the desktop executable; deployed/build SHA256 both `37F66F6EB56F623419B7E52B890E960AE43DCB05EEA76E824E107B4FA061819D`. Local health returned `ok: true`; all 39 references and both library fingerprints remained unchanged. Previous executable retained at `artifacts/stashdock-before-0419.exe`.

## Recovery

Before replacement, a consistent SQLite snapshot is saved as `artifacts/library-before-0419-modal.sqlite3`. Current library at snapshot: 39 references; content fingerprint `bc947a79100e46202dd9eff5e9ab5a2e12ed2f5c3073885ca7c204386c918614`; pinned fingerprint `631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864`. No verification mutates the user's library; browser UI writes use isolated fixtures only.
