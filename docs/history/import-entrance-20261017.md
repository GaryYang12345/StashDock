# Import entrance responsiveness

Scope: click Import references → form is visible and usable. This is separate
from the preceding compact-library-read benchmark and from deferred native
folder/panel motion. Recovery snapshot:
`artifacts/import-entrance-20261017-before` (850 source files, installed builds,
consistent 48-reference SQLite backup). No data migration.

## Implementation

- Keep the existing Arc/Radix dialog adapter. Its content-height transition
  remains Arc's smooth, non-overshooting spring. Opacity instead uses Arc's
  160 ms enter tween; a 4 px rise uses the 240 ms enter token. Exit is a shorter
  120 ms tween. Reduced motion is immediate. No text scaling or new animation
  framework, timer, screenshot or cache.
- Resolve the native portal/focus origin in a layout effect, before paint.
  Preserve focus trapping/return, outside-press guards, Escape, exit presence,
  viewport clamping and actual content sizing.
- Import is a core shelf action, so Desktop now imports its form with the shelf,
  matching MCP. Remove the separate lazy loader, idle callback, intent preload
  and empty Suspense fallback. The existing post-first-open mounted form still
  owns exit/reset; the underlying shelf never remounts. Settings stays lazy.
- Browser discovery starts on open asynchronously; it never gates the form.
  No library, original-file, clipboard or network policy change.

## Measurement

Use `scripts/verify-import-entrance.js` against the isolated native-IPC fixture.
Actual pointer clicks and rAF sampling use `performance.now()` at observation,
not rAF's earlier scheduled timestamp (which can predate the click under load).
There is no test-only opacity override in this acceptance script.

Previous warm diagnosis: approximately 523–564 ms to 90% visibility and
735–770 ms to 99%. Current warm four opens: 304–334 ms to 90%, 352–382 ms to 99%.
The first open in the current run took 473 ms to 99%; it is retained, not hidden
in a warm median. The fade after the first observed frame was 101–106 ms.
Opening height varied by less than 0.6 px and text scale remained 1.

These are dev Chromium fixture observations on this machine, not guaranteed
native WebView timings or an arbitrarily large-library latency claim. Earlier
diagnostic scripts' rAF timestamps can understate cold first-frame delay; their
visibility endpoints still demonstrate the slow spring tail. Full reports:
`output/import-entrance-ui.log` and the prior opacity-isolation log.

## Verification

- 322 frontend tests pass; TypeScript passes. Two focused regressions cover
  separate opacity/height transitions, no text scaling and no lazy import path.
- 137 native tests pass, with the existing clipboard-writing test ignored.
- Repeated opening, focus return, Escape, rapid tab reversal, reopening during
  exit and reduced motion pass. Link/Note/File retain distinct interpolated
  heights (approximately 296/626/320 px at the measured viewport).
- Light/dark, 390/768/1024/1440 px: 48 settled form layouts pass, all Save
  actions visible, no horizontal overflow or shelf reset. Slow browser discovery
  does not prevent input. `output/import-entrance-layout.log`.
- Arc review: existing Dialog, Tabs, Button and semantic tokens retained; no
  copy, color, gutter, icon policy, focus ring or hierarchy redesign. Motion
  tokens, actual content sizing, keyboard focus, both themes and responsive
  action reachability checked. Physical touch/mixed-monitor DPI not certified
  anew by this focused change.

## Packaged delivery

- Packaged MCP frontend: 24 additional layouts (both themes, four widths,
  three types) pass against the real SDK and an isolated 67-reference library.
  The 60 loaded cards survive opening/closing and optional shelf reads pause
  during Import. No real host composer interaction is simulated as proof of
  native attachment. `output/import-entrance-mcp-ui.log`.
- Source and installed portable SDK acceptance pass: context/tag read/save,
  durable retry, original bytes, canonical Note and manual entrypoints. Installed
  resource is `ui://stashdock/shelf-v54.html`. Existing live AI hosts need to
  reconnect StashDock to replace their already-loaded server.
- Desktop production build enables `tauri/custom-protocol`; its embedded entry
  `index-DTXoFJ2r.js` is verified in the executable. The installed app was
  independently restarted with Vite stopped, loaded `http://tauri.localhost/`
  and exposed the real 48-reference panel. Executable SHA-256:
  `B168F3BF44773968486F6413F46EAA799DE32E0F4ECC59A6415ABD3DB456B3C0`.
- Actual installed pointer/keyboard opening was **not certified this turn**:
  Computer Use activation failed with `failed to activate captured window`,
  including one fresh-window recovery attempt. Automation stopped rather than
  sending uncertain input. Rendered fixtures are not substituted for this
  limitation. The updated app remains running for the user's visual check.
- Installed server SHA-256:
  `bb25bae82a78868d371fb11a8a24f7bcc2d20f7c6f63f068aebe8b4e00f34ed2`.
  Installed shelf HTML SHA-256:
  `ef46f33cc5c689a8f51287fe388fc4deeffc559f702a27cdbea9ac58b3ac24b6`.
- Chrome/Edge/Firefox 0.4.13 packages regenerated; shared asset parity and
  installed Windows icon parity pass. No extension behavior or permission change.
- Canonical data remains 48 rows with digest
  `ccba2fec723184b550d5d708ae83b790fc8b6cce36c08642bc3e8398cd89c093`.
  No original asset was edited and no backup restored. Existing upstream Rollup
  annotation and MSVC missing-PDB warnings remain non-fatal.
