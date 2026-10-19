# Card consistency release 0.4.7

## Changes

- Dashboard and MCP App share the card footer, responsive action label and explicit menu-open lift state. The menu adapter reports open/close without changing Radix focus and dismissal behavior.
- Card footers remain one row. Labels use full Copy for AI / Add to chat on larger cards, Copy / Add below 260px of card content width. Accessible button names retain the full action and reference title. Source names truncate; favicon and external-link action remain available.
- Select tooltips are installed on both surfaces.
- An active favorite write uses Arc's focusable loading state and progress cursor, with a synchronous flight guard. Success is applied only after persistence. Failure retains the previous favorite value and reports an inline error.
- The server still prepares and validates a content-addressed embedded-resource snapshot. The draft adapter sends its exact text as a titled text block using `openai/title`, not ordinary untitled draft text. Single-item labels are capped at 48 Unicode code points; a batch is labeled Multiple contexts. `send:false` remains explicitly set; there is no fallback send or background-only context.

## Verification

- TypeScript project check passed.
- Frontend: 158 tests passed, zero failures. Real App SDK transport tests verify exact context bytes, single-item title, long-title truncation, multiple-item title and send:false. No draft capability, malformed snapshots and host rejection retain the no-fallback safety checks.
- MCP layout: 26 width/theme combinations, from 320 to 1440 CSS pixels. Default two columns at 380px and wider; three at 720px and wider. No page/card overflow or controls outside their cards.
- Isolated MCP UI: modal menu retains -2px lift, closes without sticky lift, Select tooltip appears, delayed favorite write has cursor progress and is not a disabled HTML button, controls hide after pointer exit. Ten widths verified single-row source/action geometry and no overlap. Reduced motion removes card travel.
- Built desktop presentation: same menu/tooltip tests and single-row geometry at 390, 768, 1024 and 1440px. These browser checks use built-in demo references, not native input automation.
- Harness Add produces the titled attachment and preserves the pre-existing test draft. The harness is not the Codex composer. Actual Codex chip rendering after reload has not been verified in this turn; old attachments retain their original host representation and need re-adding.
- Plugin 0.4.7 installed. Read-only installed-server smoke check returns shelf-v9 and 29 real references; list responses exclude full bodies.
- Windows release build and branded-icon verification passed. Installed desktop executable SHA256: 7F9D80A14E618F936B619F89290F715AC1E0F5DB3B689ABDE842E1AAE6F4587D. Exact executable restarted after backup and hash verification. Windows briefly retained an executable lock after termination; copy succeeded after release, not by modifying unrelated processes.
- Actual library and pinned-state fingerprints match before/after this turn. Rows SHA256: 183ab5632c1d8633e47e5e84446260914101823a0bd58a7e355352c055e78ea7. All write UI tests used output/playwright/mcp-test-wZRntd.

## Arc review

- [x] Existing Arc buttons, menu presentation, loading state and shared tooltip adapter retained; no vendor internals restyled.
- [x] Semantic tokens and the existing type/spacing scale; no new raw colors, emphasis weights or pointer focus rings.
- [x] Shared icon geometry and action labels retained.
- [x] Hover/menu-close, loading/success, overflow, long titles, keyboard dismissal, reduced motion, light neutral and dark blue reviewed.
- [x] Responsive geometry tested in real browser sessions, with independent embedded-panel widths.
- [ ] Native WebView input automation and touch targets were not separately exercised. This release targets the existing Windows mouse/keyboard application.
- [ ] Live Codex titled-text chip display requires the host to reload plugin 0.4.7. No Codex restart, private IPC or application localization changes were performed.

Official extension entry point: https://developers.openai.com/plugins/build/extensions
Linked OpenAI protocol specification: https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#uimessage-extensions

## Recoverable backups

- artifacts/plugin-before-card-consistency-047-20261010
- artifacts/stashdock-before-card-consistency-047-20261010.exe
