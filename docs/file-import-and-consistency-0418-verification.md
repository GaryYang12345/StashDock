# File import and consistency — 0.4.18

## Implemented

- Rule 1 in `AGENTS.md`: consistency within and across desktop/Codex is mandatory, with shared components and both-host regressions.
- Card right-click no longer opens editing; three-dot metadata/content actions remain. Tag context menus remain.
- Reference and tag destructive confirmation actions use the same Arc danger button and semantic tinted surfaces. Normal and hover computed colors match in light/dark themes; MCP light hover also matches desktop exactly.
- Import uses a 600px maximum width, compact padding, one type/import-source row and adjacent Link/Title fields where space permits. The selected Arc tab panel uses documented `forceMount` composition to avoid a stale animated height clipping dynamic fields; Arc source internals remain unchanged.
- File selection uses the official [Arc FileUpload block](https://uiarc.dev/components/blocks/file-upload), obtained from its official registry unchanged. No `onUpload` is supplied: choosing a file is local staging, not persistence or simulated upload.
- After choosing, editable Title/Content/Tags appear. Multiple files retain separate title/content drafts with an Edit file switcher and shared batch tags. Save is explicit and closes on success. Text files populate editable text; binary formats allow manual context entry rather than inventing extracted text.
- Original bytes are saved unchanged. Native and MCP validate sizes/titles/tags before atomic imports. A post-save refresh failure cannot duplicate the saved batch on Retry.
- Both card surfaces reuse typed Lucide file identities (image, PDF, document, spreadsheet, code, archive, etc.) and expose Open file. Opening resolves the saved ID, validates the managed asset boundary and rejects executable/script extensions; no caller-supplied paths or shell evaluation.

## Verification

- TypeScript build passed.
- Frontend/server: 195 tests passed. Native: 62 library + 1 standalone startup + 6 helper tests passed (69).
- `verify-file-import-0418.js`: normal 1063×684 link/file forms do not scroll, empty file panel has no metadata inputs, selection does not save, multi-file edits persist, explicit save closes.
- `verify-tags-picker.js`: 320/390/768/1024/1440 widths, click-only chooser, retained selected suggestions, stable parent height, focus/Escape, scaled native boundary all pass.
- `verify-card-consistency-0418.js`: desktop card right-click disabled, three-dot actions intact, exact reference/tag delete colors across light/dark themes.
- `verify-mcp-import-parity.js`: browser import, manual lookup, staged file edit/save and notes, 20 theme/accent/width combinations; draft unchanged.
- `verify-mcp-card-file-0418.js`: MCP right-click disabled, menu intact, typed file identity/Open action and desktop delete-color match.
- Portable MCP plugin built/installed as 0.4.18 with resource `ui://stashdock/shelf-v20.html`; installed read-only protocol smoke passed.
- Desktop and NSIS rebuilt; branded executable verified. Root executable deployed/restarted with SHA256 `60F8F314D5BD01CF4692091872295EE91C6793913B111AC5479A172F4332F9D2`; health OK. Process parent is the Windows shell, not Codex.
- Recovery snapshots: `artifacts/library-before-0418-consistent.sqlite3`, `artifacts/stashdock-before-0418.exe`.
- User library preserved at 39 references. Content fingerprint `9fc94a944cf8ba0a2788923b43bd733f2f972a1335d88ea6daf3b60643e9e6ae`; pinned fingerprint `631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864` unchanged across deployment.

## Limits

Files are local: up to 10 per save, 5 MB each, 10 MB total. Unsupported active file types can be stored but are not launched by Open file. UI tests use isolated fixtures; no real user reference was edited, opened or deleted by verification.
