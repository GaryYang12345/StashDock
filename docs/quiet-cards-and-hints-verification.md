# Quiet cards and selective hints

> Historical verification. The card appearance below was superseded by the user's clarified rollback; see card-baseline-restore-20261009.md. Tooltip and unrelated safety fixes remain in place.

## Changes

- Grid cards use official Arc ghost actions on one restrained translucent image toolbar. No individual white circular badges. Selection uses Lucide Square/SquareCheck, not concentric circles. The toolbar stays hover/focus-only; selected controls remain available.
- Per-card copies are quiet Copy/Copied actions. The bottom multi-selection bar retains the single primary black Copy for AI action. Real success stays green with a check, repeated attempts still write to the clipboard, and the existing width spring remains intact.
- Compact Dock actions are horizontal equal36px controls (44px for touch), with matching transparent idle backgrounds. Card hover does not strengthen its border.
- Hints are opt-in only via data-tooltip. Accessible aria-label does not automatically create a visual hint. Titles, domains, tags, text buttons, refresh, favorite, delete and familiar close icons no longer get redundant hints. Selection, compact copy, native form switching and the folder gesture retain concise hints.
- Pointer dwell is700ms, with no warm skip when moving between controls. Keyboard descriptions remain immediate. The user-requested reference color is the semantic tooltip-surface token #0D0D0D, with8px corners,12px text and8/12px padding. This exact color/radius is an explicit product exception to the default Arc control radius/ramp. No vendor component internals were changed.
- Folder guidance is Click to open / Drag to move, placed outside the160px folder. The existing native region owner temporarily exposes only the small folder/hint envelope. Region writes are serialized, release uses the current base region (not a cached folder), and asynchronous monitor reads are generation-guarded. Monitor work area and canvas bounds are respected; if no free side exists, the optional hint is suppressed rather than covering the folder. There is no new HWND, per-frame IPC or new Rust command.
- Tooltip timers, observer, descriptions and pending native hint work are cleaned up. Manual-popover hosting remains for genuine modal hints, but familiar modal-close controls no longer create a hint.

## Verification

- TypeScript and92 frontend tests pass, including new tests for edge placement, lack of overlap, delayed-request cancellation, current-region restoration, explicit hint selection and reference styling.
- Five real-browser fixture suites passed: verify-ui-microinteractions.js, verify-card-refresh.js, verify-shared-shelf.js, verify-arc-surfaces.js and verify-window-controls.js. Synthetic libraries/clipboard/native calls are isolated from user collections.
- Hints checked for delay, exact background,8px radius, non-overlap with the folder, Escape, keyboard and dismissal during scrolling. Compact actions checked for equal horizontal geometry and transparent idle surfaces. Copy width still125.19px to97.80px, and repeat copy acknowledgement remains functional.
- Responsive checks cover320/390/768/1024/1440px,44px touch actions, light-neutral and dark-blue, hover/focus access, real payload structure and retained selections through mode switches. Native-window fixture checks seven resize cycles, region-failure recovery, animation-watchdog recovery, focus trapping/return and no drag initiated by controls.
- Screenshots reviewed: output/playwright/ui-microinteractions-folder-tooltip.png, ui-microinteractions-dock.png and card-refresh-hover.png. These are synthetic examples, not screenshots of the user's collection.
- Arc review: existing Button, ScrollArea and other installed components retained; semantic roles,400/500 weights, shared motion tokens, quiet neutral state surfaces, keyboard focus and reduced motion preserved. Exact tooltip color and approved folder artwork are product exceptions. There is no configured lint script.
- Final two safety-only adjustments (image-toolbar focus token and pending-hint cleanup) passed the targeted real-browser rerun with no page errors before release. TypeScript and all92 tests also passed after those adjustments.

## Browser network report: not yet reproduced

The user reports actual loading/network errors while the floating folder is visible, with recovery after hiding it. This is distinct from pointer interception and is not marked fixed.

Read-only checks found no proxy/DNS/request interception code. The Chrome extension has no proxy, webRequest or declarativeNetRequest permission, and no persistent content script. The native bridge only listens on loopback. At the sampled time, the StashDock process and its six WebView descendants had one listening socket and zero established external TCP connections. WinHTTP was direct, and the current-user proxy enable flag was0. These observations do not rule out intermittent faults or other browser/proxy/security software interactions.

Needed to reproduce: browser type (Chrome vs Codex embedded), one failing URL, and the exact browser error code/screenshot. No system proxy, DNS, firewall, browser profile, installed extensions or security settings were changed. No network fix is claimed.

The user subsequently reported that the issue is not currently occurring and asked to defer investigation until it recurs. Network diagnostics stop here; UI work proceeds independently.

## Limits and release

Browser tests run real UI with mocked Windows commands and clipboard. They cannot prove physical WebView2 pointer/clipboard behavior, OS hit-testing during the transient hint region, frame rate or the reported intermittent network issue. Native build and icon verification are separate. Release artifact hashes and deployment status are recorded after packaging.

- Native release and NSIS installer built successfully; all nine icon sizes match the brand. Existing Windows SDK missing-debug-PDB linker warnings were non-fatal.
- Updated root executable and artifacts/stashdock-quiet-cards.exe: SHA256 005FA93F61923003114803D450543ED861A9CE972E8CC387D9DFDE5FE3943CED.
- Installer artifacts/StashDock_0.2.1_quiet-cards_x64-setup.exe: SHA256 13E396EBEDD0462ABECFC598C3D119BCD41FDE6F5F5C5905BF5AD5726B384347.
- Previous root preserved in artifacts/stashdock-before-quiet-cards-20261009-022752.exe, SHA256 668CA0EADCB41FFA1ACB27915301115CB44124387033E6ADD1753A606D31DBB3. User exited via the tray; no process was force-stopped. Process absence and backup hash checked before replacement.
- Root updated and restarted. Reload the unpacked Chrome extension to activate the synchronized assets; refresh the Codex embedded page to load the new UI bundle.
