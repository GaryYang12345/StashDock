# Folder visibility correction, 2026-10-19

Removed the floating folder's visual tooltip. Its accessible Open/drag description and error announcement remain available.

Both native handoff directions now hide the outgoing window before revealing the destination. The shared `window_frame::hide_immediately` disables DWM transitions, calls Tauri hide on the owning UI thread and checks native visibility. This preserves Tao's visibility cache, current geometry and rollback behavior. The old folder-only copy of this helper was removed. No custom motion, delay or timer was added.

Verification: 337 frontend tests passed; Rust passed 142 tests with one intentionally ignored clipboard test. An initial parallel native link exhausted system memory; the single-job retry passed. Production frontend and native release with `tauri/custom-protocol` built successfully. The installed Desktop executable matches the built SHA-256 `5A5CA4613B61FCDEECB9F963387A72537425B9627172B72827E52D2DA211D331`.

The actual installed app loaded `http://tauri.localhost/` and repeated panel/folder switching retained a visible usable surface. Screenshot/UI automation checks verify settled surfaces; they are not a high-frame-rate recording of DWM composition. Source regression checks cover immediate hide-before-show ordering in both directions.

The previous executable is recoverable at `artifacts/stashdock-before-folder-hide-20261019.exe`. The real library remains 48 rows with unchanged canonical digest `ccba2fec723184b550d5d708ae83b790fc8b6cce36c08642bc3e8398cd89c093`.
