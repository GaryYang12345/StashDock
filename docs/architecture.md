# StashDock architecture

StashDock is a local reference library and AI-context handoff tool, not a second AI
processing pipeline. One repository holds the shared UI and domain, the Windows
desktop (Tauri 2 / Rust), the MCP server (Node) and the browser extension. The rules
behind these boundaries are in [AGENTS.md](../AGENTS.md); product roles are in
[product surfaces](product-surfaces.md); window states in
[window lifecycle](WINDOW_LIFECYCLE.md).

## Layout

```text
src/App.tsx                          surface selection (panel/folder, folder search, browser workbench, /design)
src/features/library/                desktop library: LibraryView, controller, session, store, VirtualShelf
src/features/folder-search/          FolderSearch: the folder's hover search and cover flow
src/features/mcp-app/                MCP App host adapter (McpShelf, Settings, Add-to-chat draft)
src/features/browser-extension/      Save-page form (Popup.tsx), bundled into the extension
src/features/settings/               shared Settings, locale catalog, preferences, integrations
src/components/                      shared views (ReferenceCardView, import dialogs, tags, editors)
src/components/arc/                  Arc primitives and motion tokens (kept intact)
src/lib/                             host adapters: storage (Tauri commands), desktopWindows,
                                     context-format.mjs, reference-search.mjs, reference-url.mjs, drag
src-tauri/src/desktop_window_policy.rs   product window modes and intents (no platform APIs)
src-tauri/src/desktop_windows.rs     the one native window lifecycle authority
src-tauri/src/window_morph.rs        Windows folder/panel spatial handoff (DWM thumbnails)
src-tauri/src/window_frame.rs        scoped frame/cloak/transition operations
src-tauri/src/window_geometry.rs     pure monitor/DPI placement, including folder-search placement
src-tauri/src/folder_window.rs       folder OS drag loop
src-tauri/src/folder_search.rs       folder search window `search`: hover intent, region, focus
src-tauri/src/library.rs, library/   SQLite library, commands, search, originals, Save-page bridge
src-tauri/src/web_preview.rs, web_content.rs, preview_*.rs   background covers/text and renderer
src-tauri/src/reference_transfer.rs, reference_drag*.rs, reference_clipboard.rs   native file transfer
src-tauri/src/bin/                   stashdock-preview (renderer) and stashdock-storage (dialogs/relocation)
plugins/stashdock/server/            MCP server over the same SQLite library (node:sqlite)
plugins/stashdock/skills/            use-stashdock Skill
extension/                           Chrome/Edge/Firefox Save-page sidebar (generated per browser)
```

## Desktop windows

Three Tauri windows share one frontend bundle:

| Label | Role |
| --- | --- |
| `main` | Opaque, resizable library panel with the platform frame and shadow; normal Z-order |
| `folder` | 144 px transparent, topmost, taskbar-free folder; never mounts a library store |
| `search` | Transparent, topmost, non-activating folder search; visible only while the folder is |

`desktop_window_policy.rs` resolves Open / Minimize / Toggle / Hide / ShowLast into
Panel, Folder, Minimized (Floating window Off only) or Hidden.
`desktop_windows.rs` executes the resolved mode once, owns geometry, readiness,
monitor/DPI placement and rollback, and is used by buttons, shortcuts, tray
(`lifecycle.rs`) and native minimize/restore alike. The frontend
(`DesktopWindows.tsx`, `src/lib/desktopWindows.ts`) only requests forms; it never
writes positions per frame. The panel's shelf stays mounted across handoffs, so
query, selection and scroll survive. Visibility always goes through Tauri on the
owning UI thread.

Folder/panel handoffs on Windows travel spatially (`window_morph.rs`): a
transparent, input-transparent overlay draws live DWM thumbnails of both windows
while the real ones are cloaked, plus a pre-rendered copy of the panel's shadow
(thumbnails omit it). Expand takes 340 ms on the enter curve; collapse 230 ms on the
in-out curve. The switch between drawn and real windows happens in one composed
frame. With Animation effects off or any DWM failure the lifecycle falls back to the
direct handoff. WebViews run without native occlusion throttling
(`CalculateNativeWinOcclusion` disabled) so a cloaked panel keeps drawing.

`folder_search.rs` combines folder and search hover into one 180 ms intent delay,
keeps the window non-activating until its field is pressed, returns focus on close,
and sets a native region covering only the visible field and cards. Placement is
centred on the folder's optical axis (`SEARCH_OPTICAL_SHIFT`) and never moves the
folder. `FolderSearch.tsx` renders the field and cover flow from `search_items` /
`get_items`, copies through the shared file-group export and drags natively.

## One library, two implementations

Desktop (Rust) and the MCP server (Node) open the same `stashdock.sqlite3` and
`assets` folder, resolved from one per-user anchor (`library_location.rs` /
`canonical-library.mjs`). Moves leave a fail-closed redirect; a missing registered
library is an error, never a new empty library. SQLite runs in WAL mode with
explicit transactions and record-level writes.

Shared behaviour keeps one contract, checked by both sides:

- Schema and SQL: `schema.sql`, `search-index.sql` (trigram FTS5 maintained by
  triggers), `preview-version.sql`.
- Mirrored modules: `originals.rs` / `original-files.mjs`, `chosen_files.rs` /
  `chosen-files.mjs`, `asset_paths.rs` / `asset-paths.mjs`, `search.rs` /
  `reference-search.mjs`, `note_files.rs` / `note-files.mjs`.
- JSON fixtures: `tests/fixtures/search-contract.json`,
  `tests/fixtures/context-contract.json`, `tests/fixtures/asset-paths.json`.

File references point at the user's original and keep a managed backup; a changed
original refreshes the backup before Open, transfer or MCP reads. Notes are managed
`.txt` files. Files chosen for import are identified by short-lived tokens from the
system dialog (up to 10 at a time, 30 MB each); the UI never sends a path.

## Shelf reads and change propagation

- Desktop's shelf list (`list_items`, `read_shelf`) carries no bodies or edited
  context. Editing, copying and AI context read the references they need by ID
  (`get_items` with `full`).
- Stored covers are not read for the shelf either: `SHELF_COLUMNS` returns a marker
  built from `preview_version` (incremented by a trigger whenever a cover changes)
  and the image length, and `library/preview_protocol.rs` turns it into a cacheable
  `stashdock-preview` URL that the WebView fetches once per version.
- Background cover/icon work emits `reference-preview-updated` with the changed IDs;
  `useLibrary.ts` coalesces them and re-reads only those references.
- Writes from another provider (MCP, Save page) are detected by one passive observer
  on the existing worker connection (`ExternalChanges` in `web_preview.rs`):
  `PRAGMA data_version` plus a small content digest (reference count/last edit and
  job status counts), so lease renewals alone do not trigger a reload. A hidden
  panel reloads once when shown or focused again.
- `VirtualShelf` (TanStack Virtual) mounts only the rows near the viewport; a query
  or collection change swaps results once, after the index has answered.
- The MCP App reads pages through `list_stashdock_shelf` (`shelf-read.mjs`): compact
  rows and only that page's covers.

## Background enrichment

Pasted links are rendered once in the isolated system renderer for title, text and
cover, with a bounded direct read as fallback. Background work
(`web_preview.rs`, `web_content.rs`, `preview_enrichment.rs`; MCP
`preview-worker.mjs`, `content-queue.mjs`) runs under one leased owner per lane
across all entry points, two isolated renderers at most (`preview_admission.rs`),
at most two attempts per screenshot, and hands unfinished jobs back on exit.
Rendered text fills references imported without text and never touches user edits.
On Windows the renderer is isolated system Evergreen WebView2
(`preview_webview.rs`, `stashdock-preview`); downloads, popups and permissions are
denied, private networks refused, and the user's system proxy followed as a browser
would. See [Windows runtime/release](windows-runtime-release.md).

## Delivering context

- AI context formatting has one JS owner (`context-format.mjs`) and a native mirror
  (`library/context.rs`), checked against shared fixtures. It carries task material,
  not library bookkeeping.
- Windows Copy for AI and native drag share one immutable outgoing file group
  (`reference_transfer.rs`): Markdown context plus each managed file's current
  original bytes, published as a Shell data object (`reference_clipboard.rs`,
  `reference_drag_windows.rs`). Clipboard formats are flushed so they survive exit.
  Selection-bar drags paint the bar synchronously; there is no DOM screenshot.
- The MCP App's Add to chat prepares a read-only Markdown snapshot
  (`prepare_stashdock_attachment`) for the host draft. File references are read by
  the receiving AI through `get_stashdock_file`, which resolves an ID to the managed
  file and never claims the content was read.
- The browser-only workbench keeps a text clipboard and HTML drag payload; it is a
  development preview, not a native file transfer.

## MCP server

`create-server.mjs` registers the App resource (`open_stashdock`, global and thread
entrypoints) and two kinds of tools:

- Model-visible: `search_stashdock`, `list_stashdock_tags`, `get_stashdock_items`,
  `get_stashdock_item`, `get_stashdock_file`, `get_stashdock_context`, plus the
  bounded writes `save_stashdock_reference` (new notes/links only) and
  `apply_stashdock_tag_changes` (additive/removal tag patches with per-reference
  revisions, capped batches and conflict reports).
- App-only (`ui.visibility: ["app"]`): shelf reads, imports, edits, deletes, tag
  management, `replace_stashdock_link` (replace a saved link after the user confirms
  it, keeping identity, favorite and edited AI context), settings, storage and
  integration actions.

Desktop and the MCP App share the same link-replacement flow in the import dialog
(`DesktopImportDialog.tsx`, `store.replaceLink` / `replace_stashdock_link`).

## Browser Save page

The extension is a native sidebar with one shared form, extractor, session
lifecycle and transport; `browser-host.js` and the generated manifests are the only
browser-specific layers (`scripts/build-browser-extensions.mjs`). It talks to
whichever local provider is running: the MCP server's bridge on `127.0.0.1:17864`
(`capture-bridge.mjs`) or Desktop's on `127.0.0.1:17863` (`library/bridge.rs`).

- `POST /v1/setup` registers the exact extension origin after checking that the
  extension is installed and enabled; protected routes require that registration.
- `POST /v1/capture/lookup` returns a bounded duplicate summary for the canonical
  URL; `POST /v1/tags` returns tag names; `POST /v1/capture` performs one explicit
  create or confirmed replace and returns a compact receipt. A shared, bounded
  receipt table makes an uncertain retry safe.
- Older `/v1/import` and `/v1/items/` routes exist only to drain unfinished
  operations queued by earlier extension versions.

The extension never reads the whole library, thumbnails, cookies or history.

## Retired — do not reintroduce

- The single-window design with a fixed transparent canvas, region-based
  folder/small/large panel and custom shadow window.
- The compact "Dock"/small panel, the browser shelf and its HTTP whole-library
  listing, the HTTP-to-desktop MCP adapter, and the cross-process browser drag
  broker.
- Bundled Chromium / Chrome Headless Shell renderers and platform sign-in
  connectors.

Dated records of how these decisions were reached are in [history](history/README.md).

## Checks

`npx tsc -b`, `node --test tests/*.test.mjs`, `cd src-tauri && cargo test`; on
Windows also `npm run desktop:test` and verification of the packaged windows.
Tests use synthetic or disposable libraries, never a user's collection.
