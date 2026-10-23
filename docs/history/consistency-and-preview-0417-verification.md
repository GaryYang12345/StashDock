# Desktop and Codex App consistency, 0.4.17

## Delivered

- Valid-link lookup starts capture before Save. Desktop and MCP share bounded, three-minute single-flight caches; a foreground result is reused by background enrichment.
- Both hosts use the packaged native metadata/PDF/favicon pipeline. Normalized raster icons are retained, and existing-picture cards now queue missing favicon work too. Native icon-only enrichment persists metadata icons before returning.
- Web and PDF screenshots hide scrollbars and clip 16 pixels from the right edge (1264 by 800 capture viewport).
- Cold desktop startup opens the library while preserving the folder anchor. A launcher-job startup relaunches only the standalone executable through the Windows desktop Shell; screenshot children retain kill-on-close jobs.
- Shared Tags header has its own 36px flex row and an independently spaced Arc TagInput. Existing tags stay in a bounded floating picker.
- Both hosts use one grouped list stylesheet, a 16px top spacer/divider, 84px rows, single-line titles and narrow icon actions. Both delete confirmations use the same filled semantic danger wrapper around Arc Button.
- Plugin 0.4.17 uses shelf-v19, installed alongside the rebuilt standalone executable.

## Verification

- Frontend: 192 tests pass; TypeScript build passes. No lint script is configured.
- Native: 60 library, 1 independent-startup and 6 helper tests pass.
- Shared tag form: import and editor at 320, 390, 768, 1024 and 1440px. Header alignment, no overlap, typing without opening suggestions, retained selected suggestions, unchanged form height, Escape/focus return and save-close pass. The scaled native portal with 83 suggestions stays inside the pane.
- Shared list fixture: six widths (320, 390, 439, 768, 1024, 1440px), 84px rows, one-line titles, no overflow and filled delete hover pass. Images inspected.
- MCP harness: browser picker, manual link, note and file import; 20 width/theme/accent combinations pass. Actual MCP list has 30 visible 84px rows at 439px. Test draft remains unchanged. Import source responses in this harness are simulated; no claim that real browser profile import was exercised by the UI fixture.
- Real packaged worker produces a screenshot without a standalone app or installed user browser. Original fixture content, tags and favorite remain unchanged.
- Real MCP PDF lookup for arxiv.org/pdf/2505.22954 produces the first-page JPEG and 50,000 characters of extracted text.
- Real deepseek.com lookup produces a foreground picture and normalized data-image favicon. Second lookup reuses the picture in 1ms. GitHub denied the test request; an Arc website lookup did not yield a supported icon in this run. A favicon is not guaranteed for an inaccessible site or an unsupported image; the initial fallback remains.
- Deployed standalone PID 47480 is outside any launcher Job Object. Its exposed native region is 1063 by 684px, confirming dashboard rather than 160px folder cold startup. Codex itself was not closed during this check.
- Consistent SQLite and executable backups saved before replacement. Deployment baseline has 38 references; content fingerprint 4024b18514fff20145ff3ca202373cb3b0336429f54a4433cc8f8d752ec61682 and pinned fingerprint 631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864 remain unchanged. Five legitimate references had been added since the older 33-item backup; none were removed.

## Runtime size and timing

Chrome Headless Shell 155.0.8059.39 occupies 292,808,574 bytes (279.24MiB). The compressed archive is 124,737,213 bytes (118.96MiB). Each desktop/plugin distribution includes a copy, so both installed products carry roughly 558MiB of screenshot runtime, excluding old caches and other application files.

Three interleaved trials per engine against example.org, using fresh temporary profiles and the same full helper pipeline:

| Engine | Trials (ms) | Median (ms) |
| --- | --- | --- |
| Bundled Headless Shell | 6769, 4957, 4930 | 4957 |
| Installed Chrome | 7164, 5528, 5485 | 5528 |
| Installed Edge | 6714, 6665, 6598 | 6665 |

These include page/network/icon work and are a small single-machine sample, not a universal browser-startup benchmark. The bundled engine was faster here, so it stays first choice; installed Chrome/Edge remain the desktop missing-runtime fallback. Current packaged runtime support is Windows x64, not a Safari or macOS implementation.

## Arc review

Existing Arc Button, TagInput, Input, Popover, ScrollArea and Dialog are composed without internal rewrites. New CSS uses semantic tokens, weights 400/500 and shared spacing. No raw colors, decorative gradients, uppercase copy or hand-made focus rings were added. Stable labels, keyboard handling, reduced-motion behavior and inline states are retained. The dense desktop controls keep Arc small dimensions; existing coarse-pointer card actions expand to 44px. Pre-existing card hover lift/shadow is intentionally retained for the user's requested consistency. Light/dark and neutral/blue review passes. Automated sweeps of the new wrappers found no prohibited styling.

Windows creation-parent behavior follows [UpdateProcThreadAttribute](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute) and [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects). The app requests PROCESS_CREATE_PROCESS only; it does not alter or terminate Explorer or Codex.
