# Native-window architecture trial

## Recoverable baseline

The immutable baseline is `D:/StashDock/artifacts/version-before-native-windows-20261013`.
Its manifest records SHA-256 hashes for 698 active source files and the installed
desktop binary, plus generated desktop assets, installed plugin code and a
consistent 43-reference database snapshot.

`node scripts/rollback-native-windows.mjs` verifies that baseline without changing
anything. Following an explicit rollback request, close StashDock and add
`--apply` to restore source/binaries/plugin assets. Replaced code is archived.
The script deliberately never restores the database or original reference files:
newer collections survive a code rollback. Old geometry storage is untouched.

## Ownership

- `desktop_windows.rs` is the lifecycle authority. All handoffs run on the native
  UI thread; destinations must be ready; a failed handoff restores the outgoing
  form. Tray, shortcut, Close and UI requests use the same authority.
- The dashboard is opaque, normally sized, resizable and non-topmost. Tauri and
  Windows own its resize frame and DWM shadow. There is no custom panel region,
  permanent giant canvas, shadow bitmap, shadow HWND or NonRudeHWND workaround.
- The separate folder is transparent, topmost and taskbar-free. Its artwork stays
  160×160. A small 72px hint slot above it is excluded from the Windows input region
  except while a hint is shown. Only this isolated adapter uses a Win32 region.
- The panel remains mounted across handoffs; the folder never mounts the shelf
  store. Query/selection/scroll retain their owners. Hidden surfaces pause reads
  and shortcut work. Existing modal dismissal behavior remains unchanged.
- Position/size preferences are separate from library data. Hidden creation
  events cannot overwrite saved client sizes. Resizing is restored after native
  non-client metrics settle, not against an unshown window. Corrupt sizes and
  absent saved monitors fall back to bounded geometry.
- Window interiors keep shared Arc components. MCP/browser hosts do not inherit
  native window geometry or get another visual design system.

## Verification

The current Windows machine uses 150% display scaling. Tests use disposable
`output/mcp-test-native-windows*` databases; no destructive test targets the
real collection.

- TypeScript, packaged Vite build and 204 frontend regressions pass.
- 85 native regressions pass; one opt-in native test remains ignored.
- Real packaged WebViews load without a dev server. Import tabs and platform
  navigation work; Save/tag popovers fit native widths 390/768/1180/1440 in both
  themes. These are real window resizes, not viewport-only emulation.
- Twelve folder/panel handoffs keep client size, query and shelf nodes stable.
  Native maximize/restore and hide/reopen work. A customized 1080×720 client
  size restores after process restart.
- Window inspection confirms panel DWM non-client rendering, resize frame,
  no custom region and no topmost flag. Folder alone is topmost with a complex,
  bounded region; no obsolete shadow window exists.
- Rebuilt MCP UI is checked in its isolated SDK harness, not represented as a
  test of Codex's composer. Browser side-panel assets retain canonical sources.

Useful entry points: `verify-desktop-windows.ps1`,
`verify-native-window-handoff.js`, `verify-native-window-layout.js` and
`verify-packaged-desktop.js`. Run the JS files through playwright-cli against
the project-owned WebViews. Older fixed-canvas mock harnesses and dated design
verification records are historical, not acceptance tests for this architecture.

## Limits

This removes platform workarounds but does not prove every OS environment.
Physical mixed-DPI/multi-monitor hardware, macOS/Linux and long-session memory
still need validation. Two persistent WebViews have a baseline memory tradeoff;
there is no claimed measured performance improvement. Cross-window morphing is
intentionally replaced with stable handoff; Arc dialog/content motion remains.
