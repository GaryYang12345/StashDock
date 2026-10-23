# Compact panel and labelled content modes

## Changes

- The shared context editor now uses Arc's Content / Preview segmented control,
  with visible text and icons. The old tooltip-only icon was removed. Keyboard
  arrows and selection semantics are inherited from the same control as Grid /
  List. Saving is still explicit; switching modes preserves the mounted draft.
- Compact Desktop's white header has three rows: Context shelf with Settings /
  Import; Search with Grid / List; collections with Tags / Refresh. Settings
  moves out of the grey title bar at this width. Wide Desktop keeps its sidebar.
- Desktop keeps two card columns down to 480px of actual content width. Native
  minimum client size is 560 x 640 logical pixels, shared by configuration and
  geometry tests. Old short saved panels expand to that minimum on restoration.
  Small monitor work areas take precedence, including at high DPI. Restoring
  on a normal monitor reapplies the normal minimum after a smaller-area fallback.

## Evidence

- 346 frontend tests passed; TypeScript and production UI fixture build passed.
- Native suite: 147 passed, one existing system-clipboard test ignored. New
  regression checks configuration parity, old-size restoration and small-area
  fallback. Existing edge anchoring and DPI tests pass.
- Production fixture at 560 x 640: white header 204px, card viewport 343px,
  no horizontal overflow; the first row contains two complete cards. Fixture
  browser gutters are included in these measurements, unlike the native shell.
- At 390 / 560 / 768 / 1024 / 1440 x 640, card viewport heights were
  306 / 343 / 343 / 354 / 354px, with no horizontal page overflow. Below the
  native minimum, the browser fixture may wrap the heading rather than clip it.
- Actual Content -> Preview -> Content preserves the draft, and the mode
  control has no tooltip/title attribute. Both hosts import this shared editor.

Recovery snapshot: `artifacts/before-compact-header-20261019`.
Logs: `output/compact-header-*.log`.

## Installed artifacts

- Desktop rebuilt, replaced at `D:/StashDock/stashdock.exe` and reopened.
  SHA-256: `03f09114fc027c9dc3f504aa0cfef10193f7430f6f05bd2b6b1f2b9b264ce128`.
- Actual production `tauri.localhost` window was visually checked at its restored
  narrow size: compact three-row header and a complete first row of two cards.
  Content/Preview also switched successfully to rendered Markdown in the native
  editor. The dialog was canceled; no reference edits were saved.
- NSIS installer rebuilt. SHA-256:
  `654ed25e85b283e5e1a8ba1e38adb996fb878e35061c02da92620d1f7f09b3e6`.
- Plugin ZIP: `output/releases/stashdock-plugin-0.4.27-win32-x64-compact-header.zip`.
  42,398,058 compressed bytes; SHA-256:
  `733a733d07314276d2850a3247943bf4838f6b068d4a41f7b0ad9e1d85e3ac41`.
- Extracted package and installed personal plugin cache both passed 185-file
  manifest verification, bundled Node with empty PATH, relative stdio launch,
  isolated library operations, native web lookup and PDF retrieval. Three changed
  plugin files were installed; unchanged runtime files were retained.
- Temporary browser viewport override was reset and the fixture tab/server closed.
