# Markdown file clipboard

Windows desktop Copy for AI now copies an actual generated `.md` file, using the same canonical persisted-context snapshot, safe filename builder, and Shell IDataObject as native dragging. Single-card and selection-bar actions route through the existing controller and Arc CopyForAI button; no new UI or alternate copy/re-add menu was added.

The desktop command takes selected IDs only, validates its main source window and bounded selection, and exports without mutating the library. File/Shell work is off the async executor; OLE clipboard publishing runs on the app UI thread. OleFlushClipboard materializes the file formats so the receiver does not depend on the source app staying open. A flush failure cannot delete a file that may already be on the clipboard, and failures do not silently paste long context text.

Copy and drag exports have separate temporary directories. Cleanup is restricted to generated UUID-suffixed Markdown files older than 7 days, after a successful replacement/transfer. Copy cleanup never runs on startup or failure. Browser preview/extension retain their public text clipboard adapter; Codex MCP Add to chat is unchanged. Native clipboard file support is currently Windows-only.

## Verification

- TypeScript passed; all 212 frontend tests passed.
- Normal native regressions: 81 passed, one explicitly clipboard-writing acceptance test ignored by default.
- Explicit native clipboard acceptance passed: a Unicode-named real Markdown file could be read through CF_HDROP from a fresh COM apartment after the source copying thread/object ended. The generated fixture was left valid while on the clipboard. This test writes the OS clipboard, not the real chat composer.
- Native database fixture confirms copied and dragged Markdown bytes are identical, preserve multi-selection order and complete saved context, and do not mutate records.
- Rendered fixture passed: single/multiple IDs invoke `copy_reference_file`, existing green Copied feedback returns to the primary state, and a native error is visible without false copied feedback. The browser fixture mocks only Tauri IPC; actual Windows clipboard behavior is verified separately above. Screenshots under `output/playwright/file-copy-*.png` were inspected.
- Arc review: existing Button, semantic success class, layout and reduced-motion behavior unchanged; no internal restyling or additional visible controls. This is a transport-only change, not a new visual design.
- Production desktop build, installer build, embedded icon verification and installed MCP 0.4.26 read-only smoke passed.

The receiving Codex composer was not automated or modified. The user separately verified folder-copied `.md` files paste successfully; native acceptance verifies StashDock now publishes a real file using Windows Shell formats rather than a text/path surrogate.

## Deployment and recovery

Only `D:/StashDock/stashdock.exe` was replaced and restarted through Explorer. Its SHA-256 matches the release binary: `FDD7BC197CC18DA10B54D62424127B6065466FFED6B4854E5734E9A7B9DFA19C`. Health returned HTTP 200 with `ok:true`.

Recovery: `artifacts/stashdock-before-file-copy.exe` and consistent `artifacts/library-before-file-copy.sqlite3`. Protected library fingerprint before/after: 39 records, content SHA-256 `34439f882693a55f934a459df59e92d3ef38807cfaf292da3e5daf127a4458f5`; pinned SHA-256 `631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864`.

Windows API references: [OleSetClipboard](https://learn.microsoft.com/en-us/windows/win32/api/ole2/nf-ole2-olesetclipboard), [OleFlushClipboard](https://learn.microsoft.com/en-us/windows/win32/api/ole2/nf-ole2-oleflushclipboard).
