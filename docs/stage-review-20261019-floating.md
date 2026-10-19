# Floating window and stage review, 2026-10-19

Manually requested checkpoint across Desktop, the AI-hosted shelf, and the three
Save-page browser extensions. This is not a claim that all environments are
bug-free. Folder/panel motion remains deferred; direct native show/hide is kept.

## Recovery and data

- Recovery: `artifacts/before-floating-setting-stage-20261019`, with source,
  tests, scripts, documentation, installed Desktop binary, lock/config files and
  a consistent SQLite backup. Never restore this database over newer content.
- Before/after reference rows both contain 48 entries and SHA-256
  `4783aae975be44524274ab8c562493b320d6f11b608e3243f6c737773990c746`.
  Feature validation changed only the explicit Desktop preference and native
  window positions, not saved references or original files.

## Product changes

- Floating artwork and its close control scale together from 160 to 144px (90%).
  Native canvas is 144 x 144 logical pixels, matching the artwork footprint.
  Legacy 160 x 232 geometry migrates its retired tooltip offset once, preserving
  the artwork centre at the target monitor DPI. Anchor/edge-clamp tests cover
  100%, 125%, 150% and 200% scales.
- Desktop General has a Floating window On/Off choice, default On for both new
  and upgraded preferences. It uses the same Arc settings row/choice as Launch
  at login. Off uses native taskbar minimization, Close quits, and tray, global
  shortcut and single-instance activation restore the panel rather than folder.
  This is a Desktop-only capability, not a disabled AI-host setting.
- On/off policy belongs to the existing native window lifecycle. Applying it
  fails without committing a new native policy, and persistence is rolled back
  if that application fails. Changes broadcast to both WebViews. Read/save of
  Desktop settings and registry launch-at-login queries run off the UI thread.

## Cleanup and performance

- Removed the retired native tooltip region command, 72px spacer, custom Win32
  region ownership and JavaScript native-hint placement branch. The folder now
  installs no tooltip bubble, observer or delegated tooltip listeners.
- Removed unused Dock expand/shrink control props, icons, translations and two
  obsolete three-surface verification scripts: `verify-shared-shelf.js` and
  `verify-ui-microinteractions.js`. Their exact source is recoverable in the
  checkpoint. Historical documentation retains its historical evidence; those
  scripts are no longer active acceptance entrypoints.
- Window-state persistence has one coalesced blocking worker, not a queued task
  per focus/handoff event. It writes only changed serialized bytes. A regression
  exercises a 1,000-request burst and requests arriving at write/worker-release
  boundaries. No timers, new polling service or process-wide memory hard cap
  were added. Appearance effects no longer restart for unrelated preferences.
- Existing resource policy remains: four admitted native library operations,
  two foreground link lookups, bounded 2-pending/8-entry preview caches, four MCP
  helper children, one leased enrichment owner and bounded image/network work.
  Desktop refresh is event/focus-driven. Preview's 2s cheap probe/15s empty scan
  and non-owner takeover check, near-expiry lease renewal and visible browser
  health checks remain; reliability was not traded away to remove a timer.
- Isolated 200-note benchmark: median shelf read 60.61 -> 59.35ms, peak test RSS
  83.4 -> 82.9MiB. 100 idle checks took 22.65 -> 37.26ms, with six lease commits
  in both runs. These small absolute differences are measurement variation,
  not an optimization claim for the unchanged MCP data path. No live writes.

## Acceptance completed

- TypeScript and 349 frontend tests passed.
- Rust: 150 passed, one existing system-clipboard integration test ignored.
- Production dependency audit: zero known vulnerabilities.
- Packaged MCP AI-context acceptance: tag/search/read/save, approved tag changes,
  durable retries, shared-library visibility, provenance, original bytes, Note
  originals and manual entrypoints passed with isolated data.
- Visual specimen measured original/new SVG footprints at exactly 160/144px.
  Settings were checked at 390/768/1024/1440px, both themes, and normal narrow
  Desktop width. An initial verbose description wrapped the choice below the
  label; it was replaced by one state-specific sentence and rechecked.
- Actual production Windows app displayed the 144 x 144 folder and returned to
  the preserved panel. Off persisted and updated native button labels; it did
  not open a folder when minimizing. Relaunch restored the normal panel. Close
  exited the exact Desktop process, verified independently of the UI inventory.

## Final artifacts

- Final Desktop installed at `D:/StashDock/stashdock.exe`, SHA-256:
  `a44d34c5a430a798e078746c20314bf6003ed16285ed760f8a35b439409bfd60`.
  Its packaged `tauri.localhost` UI and final short Floating window explanation
  were rechecked after stopping the fixture server. On remains selected.
- Rebuilt NSIS installer SHA-256:
  `1f174f3eb0f625db852c190c3b4fbe7f2b15d2d1115d125d9ab9c817062d243f`.
- Plugin ZIP: `output/releases/stashdock-plugin-0.4.27-win32-x64-floating-stage.zip`,
  42,397,201 bytes, SHA-256:
  `3c62dece7cb17070537259aaf89d2c4f51102f73bac4e0073e52d32d42420242`.
  Extracted package and installed personal 0.4.27 cache both passed 185-file
  verification, bundled Node with empty PATH, relative stdio startup, isolated
  library read and actual native web/PDF retrieval. Three changed cache files
  were replaced; old user/session data and unrelated runtime caches were retained.
- Chrome/Edge/Firefox 0.4.13 packages regenerated from the same sources in
  `output/extensions`. Asset parity check passed; no daily browser permissions
  or profiles were changed. Existing unpacked extensions require a reload to use
  changed generated modules, not uninstall/reinstall.
- Actual app restart retained Off; re-enabling immediately restored folder
  behavior and the second minimize/reopen remained usable. Preference returned
  to On for handoff. A 13.64-second native idle sample kept window-state hash and
  modification time unchanged. This is a bounded idle check, not a soak test.
- Rust formatting checks passed. Source-only final cleanup removed the stale
  `expanded` prop from a legacy rendering test; focused regressions passed.
  Browser viewport override was reset and temporary fixture tab/server closed.

Mixed-DPI physical multi-monitor hardware, long-duration soak behavior and
non-Windows native packages are not newly certified by these tests.
