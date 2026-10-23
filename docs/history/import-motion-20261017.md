# Import dialog motion, 17 October 2026

This supersedes the short-travel entrance described in the earlier entrance and layout reports. The user's requirement is a readable, continuous fade and upward movement, not simply a shorter animation.

## Active behavior

- Shared `FluidDialog` moves the entire card and its contents from 16px below the settled position. Arc's non-overshooting `spring.smooth` provides the soft landing. The backdrop and card fade in together on `duration.standard` (240ms).
- Exit fades and moves down 8px on `duration.exit` (180ms). It starts from the current animated position. There is no text scaling, stagger, decorative blur or second entrance.
- The prior first-height snap, fractional measurements, independent subsequent height spring and locally owned import visibility remain unchanged. Opening does not animate height or rerender the collection.
- Reduced motion removes travel and transitions. Radix retains dismissal, focus trapping and return. No changes to data, file transport or native folder/panel switching.
- Desktop and MCP consume the same component. The browser duplicate confirmation also uses that shared component; the Save-page sidebar itself is unchanged.

## Verification

- TypeScript and 323 frontend tests pass. Native suites pass (the existing clipboard-writing test remains intentionally ignored).
- The production fixture checks successive openings, a monotonic non-overshooting rise with intermediate frames, unchanged opening height, no text scaling, dynamic Link/Note/File height, interruption, focus return and reduced motion. The height sampler starts on the input event so automation roundtrip latency does not lose the transition.
- Layout acceptance waits for actual measured height to settle, with a bounded deadline, rather than assuming a headed background window receives animation frames during a fixed sleep. Continuous interpolation is checked separately.
- `output/playwright/dialog-motion.webm` records the production fixture regression at normal playback speed, including reduced-motion checks at the end. It is not a recording of the native WebView or proof of subjective smoothness.
- Arc review: existing Arc Dialog/Radix adapter reused; shared motion tokens; transform/opacity entrance; size spring only for content changes; no changed colors, typography, controls or copy. Keyboard and narrow/theme checks remain part of acceptance.
- Production layout matrix: 48 Desktop fixture cases and 24 packaged MCP harness cases pass, including narrow/light/dark layouts and reachable Save actions. The MCP harness retains 60 loaded cards and pauses/resumes optional reads. This is not automation of the actual ChatGPT UI.
- Installed Desktop was checked with preview servers stopped: packaged `http://tauri.localhost/`, actual pointer Import, Note height change, Escape, Ctrl+N reopen and Escape. The native screenshots confirm layout and repeated operation, not native frame-time measurements. All 48 reference rows retain their pre-change digest.

Installed Desktop SHA-256: `EC3822043F7E5FAB5C11FC7BF6C2507326F648E7F9F51C74FEB57C883A52BAEE` (embedded entry `index-jDIGbk81.js`). Installed MCP server SHA-256: `e9e37384b72446cada4bf432d9d94b5314f5e33a147fb1e468a175e5e85fdc38`; shelf HTML: `58c6094019c51cf7c21bcb401d761c45e1a76bed61746b71d6d464a3e9fd657c`. Installed SDK smoke resolves the v56 resource successfully.

Recovery snapshot: `artifacts/dialog-motion-20261017-before`. MCP resource identity advances to `ui://stashdock/shelf-v56.html`; an already-connected host must reconnect StashDock to load it. Final visual preference remains the user's acceptance decision.
