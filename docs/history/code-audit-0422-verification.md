# Structural audit and consistency pass — MCP 0.4.22

## Delivered

- Dashboard content uses Arc's raised neutral shadow instead of the near-invisible resting shadow, with its own paint layer so the left grey/white boundary receives the shadow.
- Minimize, resize and hide use the actual Arc Button ghost/small component: shared shape, focus, press, loading and disabled behavior. Only icon-target dimensions and the grey-chrome semantic hover fill are composed locally. The 36px target inherits Arc's 18px radius.
- `ReferenceCardView` owns both hosts' artwork, selection/favorite/delete controls, edit menu, title, file/site identity and inline open-link footer. Native dragging/copy and MCP draft attachment remain host adapters, not duplicated presentations.
- `reconcileReferences` is shared by the native/browser library store and MCP. Equal rows/arrays retain identity; append deduplication and selection membership use maps/sets rather than repeated array scans. Preview polling retains loaded pages and avoids publishing unchanged rows.
- `readPreviewPages` checks request/session invalidation between every page. MCP explicit/passive refresh preserves loaded pages. Passive focus refresh cannot supersede an in-progress foreground read. Load-more progress is independent of ordinary refresh: gaining iframe focus no longer swallows the first pagination click. New query/filter requests hide stale pagination until the first page returns.
- Shared menu callback subscriptions are stable across host rerenders. Only actually open instances respond to cross-menu dismissal. Superseded uncontrolled tag menus reset their internal Radix state, are non-modal, and can reopen. Radix owns normal outside/Escape focus behavior; manual unconditional focus restoration was removed.
- Dialog exit restoration checks both replacement overlays and newly focused controls. Its delayed cleanup cannot steal focus and close a newly opened menu.
- File-open eligibility includes sanitized `hasFile` metadata, matching the displayed open button; opening still goes through saved ID and managed-asset validation.
- `createPreviewCache` owns bounded foreground lookup deduplication, concurrency, expiry, retry and shutdown. Pending work is never evicted or expired out of its reservation; failed work can retry. Closed services and pre-aborted helpers cannot launch another child process.
- PDF build assets use byte-aware `writeIfChanged`, preserving mtimes for identical parser, worker, bundle and license outputs. Other native build inputs can still legitimately trigger recompilation; this does not claim that all build costs were removed.
- `AGENTS.md` now records shared presentation ownership, reconciliation/cancellation and cache lifecycle rules. `scripts/README.md` distinguishes the current release acceptance suite from historical version-specific investigations.

## Audit boundary

This is a risk-focused structural cleanup, not a claim that every line was rewritten or that no defects can remain. Reviewed shared presentation/forms/menus, both hosts' state and async paths, the ordered local store, native/browser lifecycle, file opening/data boundaries, preview leases/cache/process lifecycle and build-input regeneration. Existing ordered native reads/mutations, shared import/edit/tag components and ID-based managed-file opening were retained rather than replaced speculatively.

The native OS window could not be screenshot-automated in this environment; rendered checks used the actual components in isolated browser/native-adapter fixtures. No live screen-reader session was available. Bundled MSVC missing-PDB and helper-only unused-function warnings, and third-party Rollup annotation warnings, remain build diagnostics, not silently suppressed. Historical verification scripts are retained as evidence, not advertised as passing current UI contracts.

## Verification

- TypeScript passed; 203 frontend/server tests passed; 69 native tests passed (62 library/platform, 1 preview-helper, 6 native startup tests).
- New executable tests cover equal-row/array identity, append deduplication/order, partial preview updates, stale multi-page cancellation, pending-entry eviction/expiry, concurrency limits, retry, shutdown and generated-asset mtime preservation.
- Standalone dashboard: eight light/dark × 390/768/1024/1440 checks, distinct round window hover targets, stronger content shadow, no horizontal overflow. Screenshots visually inspected.
- Standalone tag menus: Research → Design → Research and then card menus reopen/dismiss correctly. Four consecutive card menus retain one active menu and one raised card. Escape cleans both.
- Eight repetitions close an editor and immediately open another card menu during its exit; none are dismissed by delayed focus restoration.
- Existing desktop import regression: six mode switches, 96 sampled intermediate frames, content-sized Link/Note/File at 322/596/346px, no height overshoot/uncoordinated center, explicit file save closes, menu exclusivity remains intact.
- MCP dedicated 65-note database: first pagination click loads 60; explicit refresh and focus refresh retain 60. Eight light/dark × 320/439/768/1063 checks verify one/two/three columns, 84px list rows, no horizontal overflow, exclusive card menus and repeated tag-menu reopening. Screenshots visually inspected.
- MCP shared import: four light/dark sidebar/full-view checks verify natural height, staged file fields, explicit initial Save, omission of Browse, editor/menu transitions, bounds and reduced motion.
- Actual packaged public arXiv PDF regression succeeds: title detected, 50,000 content characters and 72,003-byte preview data URL. No user-library writes.
- Canonical extension assets check passed. Production desktop/plugin builds and branded native icon validation passed. Installed MCP read-only protocol/resource/context smoke passed.

## Deployment and recovery

Desktop restarted from `D:/StashDock/stashdock.exe`, independently parented by Explorer; health is `ok: true`. Root/build executable SHA256: `9E0C8553B8052EDF5E2D8B5107DD5B560A0015394C0A1FA931DFF2198667C6FB`.

MCP 0.4.22 installed at `C:/Users/86137/.codex/plugins/cache/personal/stashdock/0.4.22`, resource `ui://stashdock/shelf-v24.html`. Installed/project HTML SHA256 matches: `12B618ED2CDF4077999672E0BBA96BC13284C902DF1DA6ADA7C20E9357A6974B`. A fresh version was used because the active 0.4.21 cache could not be renamed safely during reinstall; no Codex process was terminated.

Recovery snapshots: `artifacts/library-before-0421-audit.sqlite3`, `artifacts/stashdock-before-0421.exe`. Before/after: 39 references; content rows SHA256 `bc947a79100e46202dd9eff5e9ab5a2e12ed2f5c3073885ca7c204386c918614`; pinned tags SHA256 `631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864`. Both unchanged. Preview/favicons are excluded from the content fingerprint because legitimate background rendering may update them.

Writes in UI tests were confined to isolated fixtures. User collection data and original files were not changed. Existing Codex panels may retain the old resource until closed and reopened.
