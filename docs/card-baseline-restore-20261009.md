# Card baseline restored after rollback clarification

The requested point is the ui-microinteractions card appearance before quiet-cards, not the original generic Arc Card implementation. Source was recovered from this chat's recorded reads immediately before the quiet-cards change (2026-10-08 18:10 UTC), rather than inferred from a screenshot or restored from an old executable.

## Restored appearance

- Large grid: inset 16:9 preview, independent secondary Arc buttons over the image (selection left, favorites/delete right), visible on hover or keyboard focus. No dark combined toolbar.
- Footer: title, favicon/domain with adjacent open action, primary black Copy for AI. No added date or tags.
- Compact Dock: vertical selection/copy controls, rounded secondary selection and primary black copy, both 36px or 44px on touch. Idle controls hidden; selection and successful copy remain visible.
- One stable card DOM across grid/list. Latest sparse tooltip policy retained; no title/refresh hint proliferation restored.

## Preserved functionality

Shared selection/search/filter state, refresh reconciliation, favicon fallback, clipboard payloads, immediate/repeat copy acknowledgement, successful copy green feedback, region/hint safety, native lifecycle/taskbar behavior and approved folder artwork are unchanged. No user collection or browser profile was modified. Space UI exploration remains separate from production.

## Verification

- TypeScript build passed; 92 frontend tests passed; canonical extension UI asset check passed.
- Browser card regression passed at 320/390/768/1024/1440px: hover/focus, keyboard, copy, multi-item drag, quiet borders, favicon fallback, touch targets, light-neutral/dark-blue and reduced motion. No page errors.
- Browser shared-shelf regression passed: compact/full/folder state continuity, refresh, source DOM stability, copy success/failure and stale-flight protection, drag, scrollbars and navigation movement. Success contrast 5.68:1. No page errors.
- Reviewed rendered grid hover and compact screenshots under output/playwright. Native Windows behavior is not physically inspected by these mocked-native browser tests.

The earlier quiet-cards verification document records a superseded card appearance. Its unrelated tooltip/network safety notes still apply. Release packaging and deployment are reported separately; this document does not imply that an executable has been replaced.

## Release

Windows release and NSIS installer built successfully. Native executable icon resources match the brand at all nine expected sizes. Only missing MSVC debug-symbol linker warnings were emitted.

After the user confirmed tray exit, the running-process check passed and the previous executable was backed up to artifacts/stashdock-before-rounded-card-restore-20261009-031458.exe (SHA256 005FA93F61923003114803D450543ED861A9CE972E8CC387D9DFDE5FE3943CED). The new executable was copied to stashdock.exe and artifacts/stashdock-rounded-card-restore.exe; the root/release hashes match: A8C0094A40E23524D3699FE4CB00B5894D83DFDC9F994E100751F7C796DA0540. Application restarted normally. Installer saved as artifacts/StashDock_0.2.1_rounded-card-restore_x64-setup.exe.

## Follow-up: compact Copy text trial

The user then requested a black Copy text button in the lower action position of compact cards. Dock now passes shortLabel to the existing shared CopyForAI adapter: text-only Copy / Copied, intrinsic Arc Button width, existing primary/success tokens, no redundant tooltip. Selection stays above it, right-aligned; hover/focus and persistent selected/success visibility stay unchanged. Full-library cards and the selection bar retain their icon and Copy for AI label. No Arc vendor internals, data or native lifecycle code changed.

TypeScript and all 92 frontend tests passed. The real-browser shared-shelf regression additionally checks Copy text, absence of an icon and stale square sizing, successful Copied feedback and repeat clipboard writes. Shared selection/search/filter, refresh, stable source DOM, copy failure/stale-flight handling, drag, scrollbars and reduced motion still pass with no page errors. Reviewed output/playwright/dock-copy-label.png and dock-copy-label-success.png. Production packaging is separate from these fixture checks.

Follow-up Windows release/NSIS build and native icon verification passed. After confirmed tray exit, the previous program was backed up to artifacts/stashdock-before-copy-label-20261009-033029.exe. Root executable and artifacts/stashdock-dock-copy-label.exe match SHA256 F9448A9F0C8CEEB7222102B0BEE93ED8EC122A8E761C138BEA5B3ACF3B2B8B5D. Restarted successfully; bridge health and served UI asset index-DNYjaIhr.js verified.
