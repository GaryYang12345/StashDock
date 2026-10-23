# Stage review and optimization: 2026-10-14

## Trigger and scope

This review was explicitly requested by the user. AGENTS.md now defines the workflow as manual-trigger-only, not scheduled or inferred from an ordinary feature request. The review preserves approved UI, the simple native window lifecycle and the shared collection.

Recovery snapshot: `artifacts/phase-check-20261014-before`. It contains 727 source/build files, the preceding installed desktop/plugin and a consistent 45-reference SQLite backup. No backup database was restored over live data.

## Changes

- Extracted `src/lib/reference-url.mjs` as the JS reference-identity owner. Desktop imports/deduplication, MCP persistence and the extension now remove the same tracking keys (including previously mismatched dclid/igshid), preserve meaningful query parameters and reject credential-bearing URLs. Rust already uses the same tracker set. Bookmark HTML now rejects credential-bearing URLs before creating a reference.
- Aligned desktop tag filtering with MCP's case-insensitive contract, without rewriting stored tag labels.
- Separated native screenshot-cache reservation and completion policy from browser execution. Running jobs retain their concurrency slot through TTL expiry; failures are immediately retryable; cancellation is checked before starting work and before returning results. A panicking renderer completes its reservation with an error instead of leaving a permanently pending cache entry. Focused native tests require no browser process or real collection.
- Consolidated extension asset writing behind the existing write-if-changed helper. Identical regeneration preserves mtimes and check mode remains read-only. Removed the obsolete AI-copy adapter and unreferenced external glyphs from the save-only extension.
- Lazy-loaded the legacy browser Dock instead of including its UI/controller dependencies in every initial desktop/folder bundle. The active compatibility route remains supported.
- Distinguished sidebar read errors from save errors even when an older editable draft remains visible. Removed the duplicate initial tag request; retained Save-in-place, edited-field preservation and the existing Arc Alert/Button/field components.
- Updated current architecture, product-surface and release instructions. Replaced a stale hand-built dashboard test layout with the actual production LibraryView. The installed MCP smoke check now derives its resource URI from the canonical constant rather than an outdated v29 literal; the rebuilt resource is v35 to invalidate old templates.
- Preserved the native window fix: all visibility changes remain Tauri-owned, with no raw ShowWindow hide, custom motion or temporary visual layer. Window lifecycle code was not refactored again.

## Retired files removed

25 files were deleted after reference checks and the recoverable snapshot: the retired connection-runtime downloader/preparer/pin; X prototype deployment, backup and verification helpers; their fixture; obsolete native-window compatibility/rollback/motion-seed tools; and the extension's unused AI-copy source/generated adapter and six old external glyphs.

User profiles, retired login/session directories, installed runtime/dependency caches, original/managed files, licensing notices and historical recovery evidence were not deleted. The durable extension outbox still processes legacy pending edits/deletes because removing that compatibility could lose user operations; it is not a restored shelf UI.

## Verification and deployment

- 236 frontend tests passed, including URL identity, tag matching, sidebar error semantics and idempotent asset generation. TypeScript build and generated-asset parity passed.
- Native tests: 74 library, 2 independent-startup and 23 preview-helper tests passed. One actual-clipboard-writing test remains intentionally ignored.
- Production desktop and portable MCP builds passed. The release uses tauri/custom-protocol. Desktop binary equality and installed MCP HTML/server/helper equality were verified.
- 20 rendered checks passed: desktop and packaged MCP at 390/768/1024/1440 in both themes; save-only sidebar at 390/768 in both themes. They cover grid/list, page retention after MCP pagination/refresh, read/save failures, dirty-title preservation, tag-request count and Save keeping the sidebar open. Fixtures use isolated services/data, not the user's composer. No JavaScript page errors occurred; a fixture-only favicon 404 is not a product runtime error.
- The installed MCP read-only smoke passed with resource `ui://stashdock/shelf-v35.html`, current app-only management tools and no full bodies in shelf listing.
- Actual installed Windows app opened packaged assets with no development dependency and completed three consecutive folder/panel roundtrips. Native visibility, bounded folder region, normal panel Z-order and topmost folder policy passed; normal panel outer size remained 1157 by 769 logical pixels on this machine.
- Arc styling/layout and window motion were not redesigned. Existing components and tokens were retained; screenshots were inspected.

Initial entry JS fell from 470,612 to 411,468 bytes (12.6%). This is an initial-bundle reduction, not a claim that every operation or total loaded code became 12.6% faster/smaller.

Installed desktop SHA256: `F5F46658CF9752B41488B839F9C926BBE48188FD0E9094896CD2F1E6A5590540`.
Installed plugin helper SHA256: `067296E217353A5D821596CF3118E9C0607C3CBB5F6D05032CD697A279AC0DE5`.

Live data stayed at 45 references. Rows SHA256: `e97232b31a52b3469ad4aef6d83bc80c4e05ca72985e628916d85e9d4dca977e`. Pinned-tags SHA256: `631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864`.

## Findings deliberately not changed

- Copy success feedback was investigated; it follows the external acknowledged state, not merely a settled promise. No false-green defect was established, so it was left unchanged.
- Desktop lists still render all items, and visual listing/preview refresh can read full collections before projection/pagination. Large-library virtualization and compact/detail bridge endpoints need measured, versioned work rather than an untested protocol rewrite.
- McpShelf and native library import/SQL remain relatively large. Their ownership boundaries are documented; future splits should follow query/mutation/import contracts, not an arbitrary line-count target.
- Real signed-in platform completeness, physical mixed-DPI/multi-monitor behavior and macOS/Linux releases were not newly validated. Synthetic fixtures and Windows tests do not prove those environments or every possible bug.

Desktop is restarted with the verified build. Existing Codex tasks may retain their running server/template until a new task or reconnection; reopen the shelf. Reload the unpacked browser extension to load its updated modules. No browser/account permission was granted by automation.
