# Floating window and taskbar auto-hide

## Diagnosis

The user reports that the auto-hidden Windows taskbar intermittently fails to reveal while the folder is visible, and recovers immediately after hiding StashDock. The fixed 2360×1520 logical-pixel, frameless, always-on-top native canvas is a plausible trigger for Shell fullscreen detection even though its window region exposes only the folder/panel. This identifies a strong candidate, not an instrumented trace of Explorer's internal decision.

Microsoft documents `SetPropW(hwnd, L"NonRudeHWND", reinterpret_cast<HANDLE>(TRUE))` before showing a window as the way to explicitly prevent this fullscreen classification. `MarkFullscreenWindow(FALSE)` alone would still permit automatic fullscreen detection.

Source: https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-itaskbarlist2-markfullscreenwindow

## Change

- Configure the property on the main HWND in Tauri's UI-thread setup, before tray/bridge initialization and before the hidden canvas is resized or first displayed. Fail startup if setting it fails rather than silently proceeding unprotected.
- Keep it for the HWND's lifetime, including folder/panel changes and hide/reopen. Remove it at `RunEvent::Exit`, before Tauri's window cleanup, not when merely closing to tray or on a cancellable exit request.
- Keep the current window region, always-on-top flag, taskbar button behavior, native dragging and transition engine. No new dependencies, global taskbar settings, polling, registry changes, forced Z-order operations or collection writes.

## Verification

- 75 frontend/contract tests passed, including setup ordering, hidden initial window, unchanged always-on-top, lifetime/exit cleanup and the existing drag/animation/close-to-tray regressions.
- 21 Rust tests passed. Two new Windows tests exercise the real API: a test-owned hidden 1px window verifies property set/read, idempotence, explicit removal, unchanged topmost/visibility; an invalid HWND verifies error propagation. The hidden test window is destroyed on the creating thread, including on assertion failure.
- These tests do not claim an end-to-end reproduction of Explorer auto-hide. After deployment, manually check mouse-to-screen-bottom with folder visible, after dragging/activation, in small/large panels, and after hide/reopen. Keep the user's existing taskbar settings unchanged.

## Deployment

Build the Windows release and preserve the previous root executable before replacement. Never overwrite a running StashDock process or force it to exit. Record artifact hashes and runtime checks after packaging/deployment.

- Windows release/NSIS build passed, including TypeScript/Vite and all nine branded PE icon sizes. Existing LNK4099 messages are missing Microsoft PDB debug-symbol warnings, not build errors.
- Ready executable: `artifacts/stashdock-taskbar-fix.exe`, SHA256 `C55471F4AEB4BB2167B4B041B411BF504129202538A0D2A823626D244E6208AB`.
- Ready installer: `artifacts/StashDock_0.2.1_taskbar-fix_x64-setup.exe`, SHA256 `4B752B5FDE8B359921F022833ABB44BC7565D52D370E090C4C9B57966A4BB979`.
- Verified zero StashDock processes immediately before replacement. Backed up the previous root executable to `artifacts/stashdock-before-taskbar-fix.exe`, verified SHA256 `988A078836B63B1A8CECCF4CD3200D31F19E42EB14F39760DA4682F62F501BE0`, then replaced the root executable with the verified ready build and launched it (PID17584).
- No forced termination, installer execution, system-settings change or collection mutation. Manual Explorer/taskbar auto-hide verification remains pending user confirmation; hidden API tests are not a claim of end-to-end desktop reproduction.
