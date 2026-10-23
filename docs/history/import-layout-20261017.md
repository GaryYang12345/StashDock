# Import rendering and motion ownership

Follow-up to `import-entrance-20261017.md`. The earlier short fade did not remove
the redundant opening-height spring or isolate transient visibility from the
shelf. Snapshot: `artifacts/import-layout-20261017-before`, including 855 source
files, installed builds and a consistent 48-reference database backup.

## Changes

- `FluidDialog` keeps one Motion height value. Its first fractional CSS-pixel
  measurement jumps to natural size, without interpolation or text scaling.
  Only a genuinely different subsequent content target starts Arc's smooth
  spring. Unchanged observer callbacks do not restart it; cleanup stops its
  owned control and reduced motion snaps. No height state rerenders React.
- `ReferenceImportDialog` owns open/mounted state below the Desktop and MCP
  shelves. A small React handle opens it and exposes current visibility to
  shortcuts/background reads. No parent open-state subscription, external
  store, global event, new timer, preload or second form implementation.
- The same form remains mounted after first use for exit/reset. Host inactivity
  closes it. Real Save still publishes through the latest parent callback.
- MCP optional refresh checks visibility before starting and before publishing
  reads, including focus refresh. Its existing timer resumes after close. No
  stale-card replacement behind a modal, new data source or polling cadence.
- Existing Radix focus trap, return, outside press, Escape and native portal
  remain authoritative. Arc enter/exit tokens, spacing, colors and controls are
  unchanged. Folder/panel handoff and original-file/data semantics are untouched.

## Production-mode evidence

`scripts/profile-import-opening.js` records CPU/timeline/rAF samples on an
isolated IPC fixture. Build it with Vite production mode, not the dev server.
Previous `output/import-opening-profile-height-ab.log` current warm run had
65 Layout events, 65 style updates and 130 Paint events from 300–800 ms after
click. In `output/import-layout-production-profile.log`, the current warm run
has zero for all three in that interval. The first current run also has zero
late layouts (one style update and two paints remain). CSS overrides are used
only by the separately labelled A/B diagnostic runs; accepted current runs have
no override. There is no production `height:auto !important` shortcut.

The previous production CPU-profile run's first frame was about 61 ms warm /
112 ms first-open. Current sampled runs: 37.5 ms warm / 56 ms first-open.
Without the CPU profiler, the five current pointer opens in
`output/import-layout-entrance.log` reach their first frame at 44.8 ms initially
and 33.5–38.9 ms subsequently; 99% opacity at 149.7 ms initially and 102.7–107.6 ms
subsequently. Opening height varies by only about 0.00003 CSS px, not the old
half-pixel animated drift. These are controlled browser observations, not a
native WebView timing guarantee or a claim about every library/device.

## Regressions

- 323 frontend tests and TypeScript pass; 137 native tests pass (one existing
  clipboard-writing test intentionally ignored).
- `verify-import-entrance.js`: fractional-size stability, real interpolated
  Link/Note/File heights, centering, no overshoot, rapid reversals, reopening
  during exit, keyboard focus return and reduced motion pass in production mode.
- `verify-import-lifecycle.js`: the owner renders once across three rounds of
  open, Note input, slow discovery and close. Inactivity closes the form and
  prevents reopening; reactivation resets the draft; explicit Save invokes the
  latest host callback once. All writes target the isolated fixture only.
- `verify-import-layout.js`: 48 settled layouts across light/dark and
  390/768/1024/1440 px, all actions reachable, no horizontal overflow, shelf
  unchanged. Slow discovery does not block form input.
- Arc review: existing Dialog/Button/Tabs reused, one height owner, shared
  motion tokens, no scale, semantic surfaces, stable gutter and circular
  controls retained. No copy/branding redesign. Physical touch/mixed-monitor
  DPI are not newly certified by this focused change.

## Packaged and installed acceptance

- Packaged MCP UI passes 24 additional layouts (two themes, four widths,
  three types) with the real SDK and an isolated library. The 60 loaded cards
  survive every opening/close. Optional reads pause during Import and resume
  after close (`output/import-layout-mcp-ui.log`). This is a host harness, not
  direct automation of the real ChatGPT app.
- Installed MCP 0.4.27 now serves `ui://stashdock/shelf-v55.html`; source and
  installed SDK acceptance pass, including context/tag workflows, original-file
  bytes, canonical Note, durable retries and manual entrypoints. Server SHA-256:
  `5ed99d56b91406ab1b961545bf576dc5aa4bbb111b3222e488a1638785171b8d`.
  Shelf HTML SHA-256:
  `01a98800dfbf57c0621315ddbf0ee3b3bc21d04fb7685deac97fd209a95cef85`.
- Desktop 0.2.5 production build enables `tauri/custom-protocol`. Verified
  embedded entry `index-c6LHSeXY.js`; installed executable SHA-256:
  `CFE93C03BA87A418FB271B339C8BAD236B8B4D4AD49EEE4068B863A2C1DAAF19`.
  Only the verified installed Desktop process was stopped for replacement.
  Its independent restart loads `http://tauri.localhost/` with both fixture
  servers stopped and the real 48-reference collection.
- Actual installed window: pointer Import, Link→Note→File height changes,
  settled Note Save visibility, Escape/focus return, Ctrl+N second opening
  into reset Link mode and second Escape pass. No reference was saved or edited.
  This validates actual native operation, not a numeric native frame-time claim.
  Desktop remains open for the user's visual assessment.
- Windows brand/icon parity and canonical extension asset parity pass. All
  three browser packages regenerated (0.4.13); no behavior/permission change.
- Canonical reference digest remains
  `ccba2fec723184b550d5d708ae83b790fc8b6cce36c08642bc3e8398cd89c093`
  across 48 rows. No original files or backups restored/modified. Existing
  upstream Rollup annotation and MSVC missing-PDB warnings are non-fatal.
- Existing real AI hosts were not terminated. Reconnect StashDock to replace
  an already-loaded MCP server; opening a cached old panel is not an update.
