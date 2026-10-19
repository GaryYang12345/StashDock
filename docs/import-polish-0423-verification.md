# Import and draft integration verification

Historical release record. The persistent grey Added/deduplication behavior below was explicitly reverted at the user's request in [Add feedback restoration](add-feedback-0426-verification.md). Current behavior allows intentional repeat additions and returns from temporary green feedback to the original black Add to chat button.

## Changes

- Desktop and MCP use the same native browser-source/bookmark snapshot, cache reader and bounded image normalization. Missing import icons are fetched asynchronously through the shared native helper, not sandboxed remote `<img>` requests. Only displayed rows are enriched, with 12-URL batches, four workers, deadlines, stale-view checks and a bounded MCP cache. Import remains usable while icons load.
- Favicon candidate changes reset the failed-image index. Duplicate browser-profile rows keep a later available cached favicon while preserving one selectable URL.
- Successful Add IDs persist for the lifetime of the mounted MCP panel. A synchronous in-flight guard blocks concurrent clicks; bulk Add filters previously acknowledged IDs. Partial batch successes remain acknowledged if a subsequent batch fails. Added card and bulk buttons use disabled Arc secondary styling.
- Tags and card actions share Arc dropdown-menu presentation and one spring highlight hook. Tag context actions portal independently of the animated Tags menu, avoiding transformed-parent positioning. Parent pointer leave/move cannot steal focus from an open child context menu; portal focus cannot move the parent's highlight.
- Import height still follows real form content with Arc's smooth spring. Overflow is hidden when the final intrinsic form fits; genuinely short viewports retain scrolling to Save. This removes the transient Note scrollbar without introducing a fixed-height empty form.

## Native file attachment limitation

The native PDF/file attachment request is **not implemented**. The installed Codex 26.1007.2314.0 `ui/message` `send:false` handler converts MCP text/resources into untrusted message/context attachments. Its resource converter serializes resources; it does not route them through the native composer file-upload path. The exposed MCP extension bridge has no native composer-file append operation. `files.open` opens a file, not an attachment. A file path, PDF resource link or base64 blob in context is not an original file attachment and must not be presented as one.

Read-only inspection: `webview/assets/widget-d1578c7f6cef.js` and `.vite/build/mcp-app-attachment-DibnvJgR.js` in the installed `app.asar`, plus the local `@openai/mcp-extensions` schema. Official references: [Extensions](https://developers.openai.com/plugins/build/extensions), [Plugin reference](https://developers.openai.com/plugins/reference). No host bundle modification, private IPC, real composer writes or synthetic uploads were performed. StashDock supplemental context is retained.

The host also exposes no draft-attachment removal/send notification. Deduplication is therefore panel-session scoped, not claimed to survive panel reopening or to detect a manually removed chip.

## Checks completed

- TypeScript, 208 frontend tests, 81 native tests, production plugin and desktop builds, Arc asset identity and nine Windows brand icon sizes.
- Frame-by-frame desktop Note/Link/File transitions, natural height changes and short-screen Save accessibility.
- MCP single Add after the old timer interval, direct repeat event, and mixed bulk selection deduplication in a disposable harness, never the real composer.
- Tag spring movement and context action accessibility, inline importer icons under a restrictive `img-src data:` policy.
- Eight MCP theme/width checks, pagination and focus refresh preserving 60 loaded items, equal 84px list rows, 1/2/3 responsive columns, exclusive card menus and repeated Research → Design → Research context actions followed by Rename.
- Four MCP light/dark import checks at 390px/1063px, explicit file-save affordance, menu/editor replacement and reduced-motion transitions.
- Actual Chrome/Edge/Firefox cache comparisons, read-only. Chrome/Edge favicon databases were locked by the running browsers. Real Spektralab and arXiv icons were successfully obtained by the shared background service. This is not a guarantee for sites that are unavailable or have no valid icon.

## Arc checklist

- [x] Reuse installed Arc Button, dropdown-menu tokens/presentation, ScrollArea and semantic foundation; no edits to Arc component source.
- [x] Shared pointer spring, immediate keyboard/reduced-motion highlight, Radix keyboard focus/dismissal, disabled/added states and visible error/retry paths.
- [x] Content-sized modal, genuine viewport clamping, semantic padding, unchanged form-field/Save hierarchy.
- [x] No persistence reads turned into writes; abort/stale guards and event/observer cleanup retained.
- [x] Rendered tests use isolated browser fixtures. Native Windows pointer delivery and real Codex native-file uploads are not claimed verified.

## Desktop delivery

Replaced only `D:/StashDock/stashdock.exe`, after resolving that exact target and stopping its matching process. The restarted process has Explorer as creation parent and `/v1/health` returns `ok`. Final installed and release executable SHA256: `216BE869809C131E34762CF79799283B9F1A74778DA2809414F9F54A7BA35244`.

Recovery files: `artifacts/stashdock-before-0423.exe` and consistent `artifacts/library-before-0423.sqlite3`. Protected library fingerprint remains 39 rows, SHA256 `bc947a79100e46202dd9eff5e9ab5a2e12ed2f5c3073885ca7c204386c918614`; pinned SHA256 `631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864`.

Final MCP release 0.4.25 / `ui://stashdock/shelf-v27.html` is installed. Read-only installed-server smoke verified the release, resource, editor/import tools and body-free paginated listing. Reopen the shelf to load the updated resource; existing open resources are host-cached.
