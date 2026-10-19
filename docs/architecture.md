# StashDock architecture

The app is a visual reference shelf and agent handoff tool, not a second AI processing pipeline. This cleanup changes ownership and work scheduling, not the approved folder artwork or interface design.

## Boundaries

```text
src/App.tsx                         surface selection + lazy loading
src/features/library/
  LibraryView.tsx                   full Library presentation
  useLibraryController.ts          active-surface actions, shortcuts, dialogs, FTS scheduling
  session.ts / useLibrarySession.ts shared selection, filters, search cache, layout, feedback
  useLibrary.ts                    shared subscription lifetime + environment adapter
  store.ts                         ordered reads/mutations; shared canonical snapshot
  selectors.ts                     pure search/filter/count/deduplication helpers
src/components/*                   visual components and local interactions
src/lib/storage.ts                 Tauri/localStorage persistence boundary
src/lib/context.ts                 clipboard host adapter
src/lib/context-format.mjs         canonical JS context formatting/body identity
src-tauri/src/library/context.rs   native formatter, checked against shared JS fixtures
src/lib/reference-url.mjs          shared JS URL identity; bundled into the extension
src/lib/desktopWindows.ts           typed native window request adapter
src/components/DesktopWindows.tsx   panel/folder presentation; shelf remains mounted
src-tauri/src/desktop_windows.rs     serialized native lifecycle, geometry persistence and recovery
src-tauri/src/window_geometry.rs     pure monitor/DPI bounds validation
src-tauri/src/folder_window.rs       isolated transparent folder hit-region and OS drag loop
src-tauri/src/library.rs            database, imports, FTS, Tauri commands
src-tauri/src/library/bridge.rs     Save-extension HTTP routing and trust checks (no HTML/static assets)
src-tauri/src/reference_drag.rs     source-owned Windows file drag command
extension/                         save-only native sidebar, compact capture protocol and legacy pending recovery
plugins/stashdock/server/           independent SQLite + MCP Apps server; model reads, app-only mutations
plugins/stashdock/web/shelf.html    self-contained UI resource (generated)
src/features/mcp-app/              MCP host adapter + capability-gated draft action; shared Arc/dashboard styles
plugins/stashdock/skills/           agent skill, task retrieval, original-file reading and explicit context saving
```

The browser Save surface has no Settings screen or installation-guide tab.
`Popup.tsx` composes the existing Arc form and imports the shared product control
policy, including circular icon-only targets. Provider availability uses bounded
health-only requests; toolbar/startup registration remains separate. Closing the
sidebar unmounts the form and disposes capture, tooltips, media and visibility
listeners. Async Save completion cannot restart reads after unmount.
Settings integration sections belong only to Desktop and the AI-hosted panel.
`AppearanceFields` composes the shared `ThemeChoice`: native controlled radios
with inert StashDock light/dark/automatic previews. Host adapters retain the
existing independent appearance persistence and automatic theme source. Preview
geometry and fixed semantic specimen colors have one owner; they never mount
another shelf, load user data or start capture work.
File type classification returns metadata, never legacy rendering components;
`ReferenceGlyph` remains the single colorful reference-icon renderer.

The Save-page client uses `GET /v1/capture?url=...` for a bounded ID/title/revision
summary and `POST /v1/capture` for one explicit create/replace. Both providers
recheck canonical URL and revision in an immediate SQLite transaction. Successful
operations store only a SHA-256 request digest and compact acknowledgement, capped
at 256 receipts across hosts. Retrying an unchanged operation can acknowledge it
without reapplying it. Tags are a separate names-only query; the retired HTTP
whole-library listing and browser shelf snapshot are removed. Existing pending
legacy operations retain bounded single-target recovery, never full readback.

`scripts/build-browser-extensions.mjs` generates Chrome, Edge and Firefox targets
from `extension/`. `browser-host.js` owns native panel differences. Chromium uses
a module service worker; Firefox uses a module event page and a stable Gecko ID.
`browser-extension-identity.mjs` validates Chromium origin/runtime ID equality
and Firefox's separate per-profile origin UUID and stable runtime ID. Rust mirrors
this boundary with the same product configuration. Installation checks re-read
only the matching extension's current enablement metadata; no cookie or history
inspection and no handshake-age substitute. Firefox 153+ preserves document-ID
stale-capture guards without introducing a less-safe compatibility path.

The local Save bridge treats `health` and `setup` as bootstrap routes. Setup accepts
only a syntactically valid extension origin whose exact runtime ID is currently
enabled in that browser profile, then stores that exact origin (including Firefox's
profile UUID). Capture, tag and legacy recovery routes require both the browser
header and a registered origin. The extension performs at most one setup repair
after a `403`, then retries the original request once; it never enters a replay
loop. Public browser-store releases must additionally bind Chromium to the final
signed store IDs (and Firefox to its signed identity), or replace this bootstrap
with a native-messaging allowlist.

## Data lifecycle

- The native panel owns one library store in its persistent WebView. Its separate folder window never mounts a library store. Switching visibility does not remount the panel; the MCP shelf retains its explicit host adapter.
- One read flight coalesces concurrent refreshes. An import event during a read marks it invalid and causes a fresh read. Mutations and refreshes share a queue; failed writes do not change the snapshot or poison later operations.
- New imports write only their batch. Native files already committed by Rust are published without a second write. Favorites update one ID without rewriting screenshots, body content or FTS. Deletes are explicit.
- Migration runs once per WebView; subsequent loads use `list_items`. Isolated browser previews use localStorage; the retired browser-shelf polling/HTTP adapter is deleted.
- Refreshes reconcile unchanged item objects and skip identical snapshots. Search text is cached per item-list version; selection uses ID lookups. Native FTS ranking is retained, with results resolved against current canonical items.
- Desktop session state outlives folder/panel switching. Selection, query, collection/tag filters, view, search cache, refresh pending and transient feedback have one owner. Only canonical ready snapshots prune missing IDs; filtering and shape changes do not. Feedback timers replace older timers and are cleared on session disposal. Hidden surfaces pause FTS work, and the active surface reuses the same result cache. Dialog/focus state remains local to its host.
- The FTS migration marker avoids rebuilding the entire index at every startup. Upserts index the actual persisted body, including content retained by `COALESCE`.

## Performance decisions

Windows public previews use an isolated system WebView2 COM session, not a
redistributed Chromium or the user's daily browser. Native downloads/popups and
permissions are denied before navigation; the public-only pinned-DNS proxy and
owned renderer job remain. Temporary profiles and bounded commands/events have
one owner. The plugin bundles a hash-pinned official Node executable, so its
MCP launch never depends on system Node. Release ZIPs use an explicit runtime
allowlist and manifest. See [Windows runtime/release](windows-runtime-release.md).

Default AI context is a task-material envelope, not an export of library
bookkeeping. It omits import browser/folders/saved dates and absolute managed
paths; meaningful provenance, body identity and known capture/export limitations
remain. User-edited final text, including empty values, stays verbatim. The
native transfer snapshot is formatted only after actual outgoing attachment
names are assigned, without updating the saved metadata. Delivered Notes use
their original TXT instead of repeating the derived body in Markdown; MCP keeps
the readable Note projection and ID-based original-reading requirements.
`tests/fixtures/context-contract.json` checks both implementations.

Model-side tag organization reuses the same tags as context groups. Search and
bounded reads expose a tag-only revision for each reference. After a user reviews
a broad plan (or directly requests an exact small change),
`apply_stashdock_tag_changes` accepts only additions/removals and the latest
revision, preserves every unmentioned tag, caps a batch at 30, and skips stale or
missing references with explicit conflicts. It cannot edit titles/content,
globally rename tags, delete references or accept a caller-asserted approval flag.

The Library is lazy-loaded as a surface; its core Import form is part of that same module graph, as in the MCP panel. Opening Import never waits for another module request or Suspense retry. There is no idle/hover preload policy. Settings remains a separate lazy view. `FluidDialog` resolves its portal before paint, separates the short opacity tween from the non-overshooting content-height spring, and never scales text. Initial natural layout establishes the opening size; later tab/content changes retain measured height interpolation. Browser discovery starts only when opened and does not gate the entrance.

`ReferenceImportDialog` owns its transient open/mounted state below each shelf.
Its small React handle opens the form and provides a live `isOpen()` predicate
for shortcuts and optional background work. Opening does not update the shelf
owner. The form remains mounted after first use for exit/reset behavior; host
deactivation closes it. MCP checks the predicate before and after passive reads,
including focus refresh, so stale work cannot update cards behind an open form.
There is no external overlay store, event bus or additional polling timer.

Import height is one Motion value: the first fractional-pixel measurement jumps
to natural size, and only a changed content target starts the smooth spring.
No height React state or auto-to-rounded-number opening spring. Resize observers
never restart an unchanged target; reduced motion snaps and cleanup stops the
owned animation. Opacity/translation do not share the height animation owner.

Cards are memoized with stable action callbacks; unchanged data retains references. Screenshots load lazily and decode asynchronously. Images disable native dragging and pointer targeting so a host's image-drag interception cannot replace reference context. All cards and selection bars use `reference-drag.ts` for formats and cleanup. Native dragging keeps the lightweight card bitmap and standard Shell translucency; selection-bar dragging paints the bar synchronously without a DOM screenshot engine. Each card has one transform owner.

Browser-only Library previews retain the browser-owned HTML drag gesture, using one shared
text/Markdown/escaped-HTML payload and connected canvas preview. Chromium's public
`DownloadURL` metadata additionally describes a Markdown file containing the same
context as a UTF-8 data URL. It requires no HTTP request, input-queue handoff,
clipboard write, synthetic File path, host IPC, local-file access or automatic
send. DownloadURL is Chromium-specific and file-target compatibility is not a
guarantee; browser regression success does not establish Codex composer receipt.

Desktop Dock and Library instead use `drag_reference_file` via their own Tauri
window. The command validates the main source window, selected IDs and bounded PNG,
reads canonical persisted context, writes a generated .md file and runs Shell
CF_HDROP/alpha-preview OLE on the app UI thread. The frontend cancels its HTML drag
only in Tauri, prevents duplicate native starts and reports rejection without
pasting text. Both worker and UI-loop entry require StashDock foreground ownership.
Completed exports survive for deferred receiver reads; only generated expired
temporary exports are eligible for cleanup. No saved original assets are moved.

The old cross-process HTTP broker is permanently retired (410), not merely hidden
behind a token. Sidebars are never allowed to initiate an OLE loop in StashDock.
Human verification also rejected the browser File-object trial: it is removed.
Browser preview works, but actual Codex sidebar-to-composer attachment receipt
is unsupported/unverified; do not claim it is fixed or invoke private host IPC.
Native CF_HDROP unit tests do not prove actual composer receipt either.
The native panel now has actual resizable viewport bounds, without CSS content scaling. Windows manages its frame, corner policy and shadow. The separate transparent folder keeps the same artwork and OS drag gesture.

Windows desktop Copy for AI now invokes `copy_reference_file` with selected IDs.
It shares the native drag context snapshot and file writer, then publishes the
same Shell IDataObject on the UI thread with OleSetClipboard/OleFlushClipboard.
The clipboard holds a real existing `.md` file, not context text or a path string.
Flushing keeps formats available after app shutdown. Copy exports have their own
temporary directory; cleanup runs only after successful replacement, never on
startup or on a failed copy, and touches only generated files older than 7 days.
Browser preview retains public text clipboard support. The extension is save-only and does not bundle an AI-copy adapter. Codex MCP Add keeps
its draft-context behavior unchanged. No automatic paste, host launch or send.

Grid and list change CSS on the same card tree, rather than remounting two maps. Favicon fallback progress and loaded image nodes survive the change. Arc's free ScrollArea writes scroll thumb geometry directly to the DOM, without React updates per scroll frame. CopyForAI composes the existing Arc primary Button at full/icon-only densities; it never launches an AI application.

No new state library, rendering framework or animation package was added. TypeScript rejects unused locals and parameters. The retired fixed canvas and custom shadow are saved in the version snapshot, not retained as a second active architecture. Do not restore per-frame position IPC. Geometry preferences use window-state-v2.json, separate from previous browser geometry storage and collection data. Window visibility goes through Tauri on its owning UI thread, keeping Tao flags and actual HWND visibility synchronized. Both directions hide the outgoing surface with native DWM transitions disabled before revealing the destination; failures restore the previous form. The folder keeps accessible open/drag instructions without a visual tooltip. No custom handoff motion is active. Startup always shows a normally sized panel.

## Phase two: UI redesign boundary

1. Define shared typography, spacing, surfaces, component states and motion tokens in `design.md` and the styling layer.
2. Redesign Library presentation and card components using the controller/store contract. Do not embed persistence or import parsing into visual components.
3. Unify empty/loading/error, multi-selection, copy feedback, dialog and header controls across surfaces.
4. Review screenshots and interactions in desktop and embedded browser, not just a successful build.

## Deliberate remaining work

Stage review is manually triggered by the user, not scheduled. Its procedure is in AGENTS.md. JS URL identity has one owner; desktop tag filtering is case-insensitive like MCP. Preview caches keep running reservations through TTL expiry and permit failure retries. Extension asset generation preserves unchanged mtimes. Retired connector tools were removed after a recoverable source/build/library snapshot; user profiles and runtime data were not deleted.

- Lists still render all cards. Lazy image loading is not virtualization; evaluate a large synthetic library before choosing pagination/virtualization, especially around drag/drop and Motion layout.
- The extension is a save-only native side panel. `Popup.tsx` composes shared Arc fields and `ReferenceTagsField`; `sidepanel.js` adapts activeTab capture and the durable worker save. It has no shelf or bookmark permission. Archived popup/overlay verification documents describe earlier iterations, not the current architecture.
- Before browser-store publication, configure the final signed Chrome/Edge extension IDs and Firefox signing identity in the local bridge allowlist. Runtime presence plus exact-origin registration is the development boundary, not proof of store-issued identity.
- The two small, persistent native WebViews trade some baseline process memory for independent platform-owned windows. The folder never mounts a library store. Long drag sessions, physical mixed-DPI monitors and macOS/Linux native behavior still require hardware validation; pure geometry tests and this Windows machine do not prove every environment.
- SQL/file-import functions remain in `library.rs`; HTTP has been separated. Split further by responsibility when adding import adapters, not by arbitrary file length.
- Older UI snapshots/backup artifacts are preserved rather than deleted. They are ignored and not imported into the application bundle.

Tests: `npm run test:frontend`, `npm run build`, `npm run desktop:test`, and `npm run desktop:build`. Tests use synthetic repositories or disposable SQLite databases; do not use user collections for destructive checks.
