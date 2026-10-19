# Stage review: performance, 2026-10-17

Manually requested. Recovery: `artifacts/stage-performance-20261017-before`.
It contains 836 source files, installed Desktop/plugin artifacts, generated UI
and a consistent 48-reference SQLite backup. No old database was restored.
Approved Arc presentation, file authority, browser Save lifecycle and native
direct folder/panel switching remain unchanged.

## Confirmed issues and owners

- Native library commands previously performed SQLite, managed-file reads and
  some image work synchronously on the window thread. `library/commands.rs`
  is now the asynchronous host adapter; the original library functions remain
  domain operations. Shared `blocking_work.rs` admits at most four library
  tasks and two foreground link lookups. Worker-owned RAII reservations survive
  cancelled callers and release on success, error or unwind.
- Desktop's lazy import module could first load on the click. The same module
  is prepared during idle time or pointer/keyboard intent without mounting a
  form, reading files or discovering browsers. Its idle callback is cancelled
  when the shelf is inactive. Browser profiles import sequentially with a
  50,000-row aggregate bound; leaving the operation stops scheduling new reads.
- MCP shelf refresh previously loaded all rows including full bodies and
  base64 thumbnails before slicing a page. `shelf-read.mjs` now owns a single
  read transaction: compact filter metadata, current page covers, shared
  JavaScript search semantics and tag counts. Body fields are read only for
  actual text search. Context/detail tools read selected IDs; tag/URL/CSP
  discovery uses a metadata index. Custom test adapters retain the existing
  provider interface. No wire protocol or second library was added.
- MCP optional preview refresh pauses during import, settings, edits,
  confirmations and foreground reads, retaining current cards and pagination.
- Both preview owners previously rewrote leases on every queue tick. They
  now use read-only ownership checks and renew a 90-second lease when 60
  seconds remain (about every 30 seconds). Transactional ownership is rechecked
  before acquisition/renewal/claim. A non-owner checks takeover every 15s.
  Empty queue scans use `PRAGMA data_version` to see cross-provider changes:
  a cheap active probe remains every 2s, a full unchanged-empty scan is at most
  every 15s. A new external write invalidates the empty result immediately at
  the next probe. Running MCP jobs retain the 15s lease-health timer.
- Unchanged Note projection checks no longer acquire an immediate writer
  transaction. Real changes are re-read after the transaction is acquired,
  preserving concurrent metadata edits. Node's query excludes cover blobs.
  Both native and Node reads have a 5 MB bound even if an editor grows a file
  after stat. Open does not scan unrelated notes; transfer snapshot preparation
  no longer synchronizes the same projections twice. There is no file polling
  timer, stale original-file cache, internal viewer or snapshot-based Open.
- `preview-helper.mjs` owns helper admission, output, timeout and cleanup.
  At most four children per MCP process; a killed child retains its slot until
  close. UTF-8 is decoded across pipe chunk boundaries, fixing possible broken
  Chinese titles/content. Oversized output is discarded before termination.
  Removed the unused `packagedLinkLookup` export and the duplicated old helper
  lifetime implementation, not recovery or user data.

## Resource policy audited

These are scoped bounds, not a claim that the entire product has a fixed RAM
ceiling across all independently launched host processes.

| Resource | Active policy |
| --- | --- |
| Native library blocking work | 4 admitted tasks per Desktop process |
| Native foreground link lookup | 2 admitted tasks per Desktop process |
| MCP auxiliary children | 4 children per MCP process, released on actual exit |
| Foreground preview / icon caches | 2 pending and 8 entries per cache |
| Background enrichment | One leased owner across shared providers |
| Owned Windows Chromium job | Existing 768 MiB job limit and kill-on-close |
| Image decoding | Existing 4096px dimensions and 64 MiB decoder allocation limit |
| Preview network proxy | Existing 24 connections, 24 MiB session budget, bounded lifetime |
| Imported originals | Existing 5 MB each, 10 MB total in the file form |
| Outgoing original-file group | Existing 100 originals, 100 MB total |

Desktop library refresh remains event/focus-driven, not a new polling service.
Settings detection remains entry/focus-driven. Browser provider health remains
15s while visible; existing tab/document reconciliation and DOM settling are
retained to preserve long-lived sidebar recovery. No new persistent polling threads, watcher
service, telemetry UI, user configuration switch or UI-process hard cap added.

## Isolated measurements

Command: `node scripts/benchmark-stage-performance.mjs [source-root]`.
Compare recovery `source` with current source in separate processes. Fixture:
200 Notes, 17 KiB text and 120 KiB inline cover per row; display limit 30,
eight reads. No network or live-library writes. Measurements include Node and
SQLite overhead; peak RSS is the entire synthetic test process.

| Measurement | Before | After |
| --- | ---: | ---: |
| Shelf page median | 1253.89 ms | 67.62 ms |
| Shelf page maximum | 1301.02 ms | 87.68 ms |
| Test-process peak resident memory | 365.1 MiB | 87.4 MiB |
| Lease commits across 100 checks, simulated 2s cadence | 100 | 6 |

The first read-only-note changes alone barely changed full-shelf throughput;
the large improvement came from removing full-library body/cover hydration.
These results are fixture measurements, not guaranteed real-world latency or
an assertion of zero leaks. The benchmark maximum is not a hard RAM cap.

## Verification and delivery

- 320 frontend tests passed (`output/stage-perf-frontend-clean.log`), including
  busy-writer read-only checks, lease ownership, immediate new-work detection,
  pagination/search parity, atomic external file edits, bounded child lifetime,
  cancellation, pipe output overflow and split UTF-8. TypeScript passed.
- 137 native tests passed: 107 library/window tests, 2 independent-startup,
  24 preview-helper and 4 storage-helper tests. The existing clipboard-writing
  test is intentionally ignored. `output/stage-perf-native-release.log`.
- 24 repeated rendered Desktop fixture imports passed, light/dark and
  390/768/1024/1440 widths, including Link/Note/File switching, close/reopen,
  unchanged shelf and no page errors. A final settled-layout pass confirms Save
  remains inside the dialog with a visible bottom gutter. Initial screenshot
  capture during a tab spring was not accepted as a settled-layout result.
- Final packaged MCP frontend against a fresh isolated local backend verifies
  missing-icon polling actually runs, pauses during Import and resumes after
  closing; pagination retains 60 cards after foreground refresh. Final report:
  `output/stage-perf-ui-accepted.log`. No live-library mutations.
- Source and installed portable server SDK acceptance passed, including tag
  search/read/save, restart-idempotency, original file bytes, canonical Note TXT,
  separate supplemental context and manual panel entrypoints. Installed smoke
  confirms `shelf-v53`, list bodies excluded and app-only editing tools.
- Desktop production build enables `tauri/custom-protocol` and embeds
  `index-D1EFQQ8z.js`. Installed executable SHA-256:
  `E1A1E4E6E5ED17000C2A5326F369934E78F4DE4623B604C87A783FCB28EF9A30`.
  Installed server SHA-256:
  `EA78D9C9C475545CD85C1C773940B46D44DCFA9D9B9B78105BEE548A34F7DF39`.
- After stopping Vite, the actual installed native window loads
  `http://tauri.localhost/`. Pointer import, browser-source menu (Chrome, Edge,
  Firefox), menu Escape, dialog close, Ctrl+N reopen and dialog Escape passed.
  No file, link or note was saved during this acceptance. Windows brand icon
  parity passed. The independently launched Desktop remains open.
- Chrome/Edge/Firefox 0.4.13 packages were regenerated from shared assets.
  Browser behavior is unchanged; the shared locale additions required asset
  regeneration. Final parity passed. An intermediate test run against stale
  generated assets failed correctly; the regenerated clean suite passed.
- The 48 live reference rows remain byte-equivalent by canonical column digest:
  `ccba2fec723184b550d5d708ae83b790fc8b6cce36c08642bc3e8398cd89c093`.
  `scripts/verify-stage-performance-data.mjs` opens both databases read-only.
  No backup was restored, no collection/profile/session data deleted.
- Arc review: existing Dialog, Button, Tabs, fields, semantic tokens and
  StashDock circular-control variant retained. No CSS, visual hierarchy, focus
  policy, tooltip style or motion token was changed. Keyboard dismissal,
  both themes, narrow/wide layout, disabled Save and settled action reachability
  were rendered. Physical touch/mixed-monitor DPI were not newly certified.

Existing MSVC PDB and upstream bundler annotation warnings remain; no dependency
version upgrade or native window animation change is part of this stage.

Remaining scope: compact metadata filtering is still O(N), and Desktop does not
virtualize every card in a very large library. This stage is not certification
for arbitrarily large collections or a proof of leak-free multi-day operation.
WebView2/OS threads are not governed by the background admission count; retain
platform scheduling instead of forcing an arbitrary UI thread/RAM ceiling.
Unusually slow disks, very large libraries and signed-in browser extraction can
still need separate profiling. Existing live AI hosts must reconnect StashDock
to replace their already-loaded MCP server; no real AI host was terminated.
