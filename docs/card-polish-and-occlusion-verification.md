# Card polish and transparent-window occlusion

## Scope

Preserve the approved rounded card baseline. Compact Copy now includes Copy/Check icons and follows pointer hover, with a keyboard focus-visible exception and always-visible touch controls. Selected controls remain visible. Expanded image controls are true 36px circles (44px touch); saved stars use the scoped `favorite-star` yellow token. Embedded Codex previews widen to112×72px at ≥480px; native compact previews stay72×72px.

## Performance diagnosis

Read-only inspection of the running old executable found a2360×1520 backing HWND with a160×160 folder region. `GetWindowRgnBox` returned SIMPLEREGION (2); WS_EX_LAYERED, WS_EX_TOOLWINDOW and WS_EX_TRANSPARENT were absent. Short idle CPU sampling did not show sustained CPU activity, so a CPU busy loop was not established.

Chromium's [IsWindowVisibleAndFullyOpaque implementation](https://chromium.googlesource.com/chromium/src/+/main/ui/gfx/win/hwnd_util.cc) excludes COMPLEXREGION windows, but for a simple region proceeds with the full GetWindowRect bounds. Its [native occlusion tracker](https://chromium.googlesource.com/chromium/src/+/main/docs/windows_native_window_occlusion_tracking.md) uses this visibility decision to avoid rendering occluded browser windows. The observed folder therefore meets the criteria for falsely occluding a much larger area than its visible surface. This is an evidence-backed mechanism, not proof that every reported intermittent stall has the same cause.

`create_window_region` now uses rounded regions with at least a2-physical-pixel diameter for every state, including folder, tooltip expansion and transition envelope. That cuts only transparent outer corner pixels while preserving bounds; the existing17px panel radius is unchanged. Windows GDI tests check COMPLEXREGION and exact bounds at100/125/150/200% scale. No click-through style, taskbar suppression, browser setting, GPU disablement, global shell mutation or polling is introduced.

The Dock also mounts only on first use; inactive surfaces stay mounted to retain state but skip rendering with content-visibility:hidden. The permanent transform promotion on the collapsed anchor was removed. These reduce work without resetting selection or scroll state.

## Verification

Isolated browser fixtures cover hover after selection/success, keyboard access, repeat and failed copy, circular controls, favorite toggling, responsive preview widths, shared state, window transitions, light/dark, touch and reduced motion. They do not write to the user's collection. Native tests verify region geometry. Actual background-app responsiveness must still be observed with the replacement executable under the user's normal workload.

Completed checks: TypeScript build;96 frontend tests;22 Windows native tests; `verify-shared-shelf.js`, `verify-card-refresh.js`, `verify-arc-surfaces.js`, `verify-window-controls.js`. Arc surfaces include320/390/768/1024/1440px widths and the browser extension. An initial dialog focus assertion was timing-sensitive; the complete surface suite passed on rerun. The first parallel native compile exhausted available memory; single-job compilation passed. Existing MSVC missing-debug-PDB warnings were nonfatal.

## Local release verification

The optimized executable and NSIS installer built successfully. After the user's tray exit, the old executable was backed up and `D:\StashDock\stashdock.exe` replaced and started. SHA256: `33ACD8CD49219C5E4153071DC97F0E92F413F4C976AB005694941943F9160D9C`.

The actual displayed folder now reports COMPLEXREGION (3), retaining the same160×160 region bounds and2360×1520 backing HWND bounds. `scripts/verify-native-occlusion.ps1` performs this read-only verification. The local health endpoint returned ok, and the embedded Dock served the new `index-DZb2TSTt.js` bundle. This confirms the native exclusion and frontend deployment, not every possible intermittent stall under real workloads.

## Follow-up: compact density and pointer focus

User feedback identified another pointer-focus path in the expanded image toolbar. Grid and list controls now use their own focus-visible keyboard state instead of card-wide focus-within; a mouse click on Star no longer pins the three controls. Selected checks still remain visible, and touch controls remain available.

The compact Copy adapter maps Arc's scoped height/font/spacing tokens to32px/12px/8px; its parent action column reserves84px for the longest success label. The button still morphs intrinsically, but the card's title column never resizes. Full-size Copy for AI is unchanged. Touch retains44px minimum targets. The star token uses the explicitly requested #E8B931; Import references uses the official secondary Button variant with no vendor source changes.

TypeScript and97 frontend tests passed. `verify-shared-shelf.js` samples title geometry throughout copy feedback and tests pointer exit after favorite; `verify-card-refresh.js` checks grid/list pointer exit and exact star color in addition to responsive, theme, keyboard, touch and copy coverage. `verify-dock-density.js` verifies a long title at320/390/600px, Copy→Copied geometry and compact touch targets. All three browser suites passed. Before/after screenshots: `output/playwright/dock-density-copy.png` and `dock-density-copied.png`.

Follow-up release built and passed embedded brand-icon verification. The previously running application was confirmed exited before backup/replacement. New executable SHA256: `46B31CCB51C352225E9692D9735FD080031B86A0ED2A138617296CD100B02994`; archived as `artifacts/stashdock-card-density-hover.exe`, with corresponding NSIS installer. The old33ACD8CD release remains recoverable in the timestamped before-card-density backup.
