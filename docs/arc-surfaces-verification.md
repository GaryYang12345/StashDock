# Arc surfaces: implementation and verification

Date: 2026-10-08. Scope: desktop Library, compact Dock, Codex embedded Dock and
the plain-HTML Chrome/Edge side panel. No Rust storage, bridge permissions, MCP
tools, plugin host capabilities or approved floating-folder artwork changed.

## Implementation

| Region | Shared implementation |
| --- | --- |
| Dock rows and batch actions | Official Button/CopyButton; compact business layout; same structured context and drag payloads |
| Import modes | Official Tabs, Input, Textarea and Button; visible labels, actual pending states and inline Alert |
| Empty, loading, failure | Official EmptyState, Skeleton and Alert; clear filters/retry without hiding retained items |
| Native dialogs | Arc Dialog root plus documented Radix Portal container, Content/Title/Description; pane-local geometry, focus return and Escape |
| Extension | Same Arc foundation and local Inter, supplied full brand, generated official Lucide SVGs; no React or remote UI runtime |
| Codex plugin | Existing read-only Dock URL and shared DockView; no separate UI, new permissions or MCP configuration |

The six new free registry items were copied from official `uiarc.dev/r/<id>.json`
after the batch shadcn command timed out. This is the official manual-install
fallback, not a reconstruction. Official component internals remain unmodified;
platform adaptation lives outside them. No Pro code is included.

`scripts/sync-extension-ui.mjs` copies canonical tokens, local assets and notices,
renders Lucide SVGs, and transpiles `src/lib/context.ts` for the extension. Its
read-only `--check` detects byte drift. Extension version is 0.1.5, with unchanged
permissions. Existing unpacked installations require Reload on the extensions
page; no extension was installed or reloaded on the user's behalf.

Removed obsolete `.field` styles, global control press transforms, global
input/label transitions and image entrance animation. Motion follows shared
tokens and reduced-motion preferences. Fixed a lazy-dialog opening-press race
that could dismiss the dialog on first click. The original fixed native canvas,
input regions, native dragging and hide-to-tray behavior are retained.

Monochrome brand theme adaptation now belongs to BrandIcon itself rather than
separate Sidebar/DesignLab selectors. This fixes the previously black-on-dark
Dock brand preview without changing light-mode artwork.

## Automated and browser checks

- Frontend: 69 tests pass. Rust: 19 tests pass.
- Production TypeScript/Vite build passes. Windows executable and NSIS installer
  compile; icon resource verification checks all nine branded raster sizes.
- `verify-arc-cards.js`: grid/list keyboard actions, selection, multi-drag, light
  neutral and dark/blue, reduced motion, responsive widths.
- `verify-arc-surfaces.js`: 320/390/768/1024/1440px without sideways overflow in
  Library, Dock and extension; narrow import dialogs; link validation/import,
  bookmark HTML import, delete confirmation/cancel, focus return, Escape,
  structured single/multi-copy, clipboard failure, current-tab refresh,
  screenshot preview preservation, extension import and disconnected retry.
- Browser mutation tests use fresh contexts, synthetic collections, intercepted
  local bridge routes and mocked Chrome APIs. They do not read real Chrome
  bookmarks or change the user's desktop collection. Extension loading inside
  Chrome/Edge with real APIs remains a separate user acceptance check.
- `verify-window-controls.js`: isolated native-command fixtures pass seven
  compact/full resize cycles, shared neutral close feedback, folder/close hover
  attachment, reduced motion, rounded compositor regions, rejected-region
  rollback and missing-animation-completion recovery. Import dialogs stay inside
  the visible Library pane; Tab/Escape and focus return pass. Control clicks do
  not start native dragging. All three forms use the same hide command.
- Extension native `<dialog>` keeps underlying controls inert. Tab may reach
  browser chrome (the document reports body focus) and then returns to the modal;
  this is normal browser accessibility behavior, not a custom focus trap.

Screenshots: `output/playwright/arc-dock-complete-{light,dark}.png` and
`arc-extension-complete-{light,dark}.png`. Real preview colors are not recolored.
Dark/blue screenshots verify token readiness, not a shipped dark-mode setting.

## Arc task

- [x] Find existing free components for each region.
- [x] Install official sources, foundation imported once per surface.
- [x] Wire documented props, real promises and shared data contracts.
- [x] Compose one-purpose layouts, visible states and stable rows.
- [x] Apply semantic tokens, type scale, sentence case and shared motion.
- [x] Review code sweeps, TypeScript and browser flows. No project lint command is configured.

## Arc review

Type and copy:
- [x] Sentence case, no decorative eyebrows, uppercase transforms or em-dash UI copy.
- [x] Weights 400/500 and type-scale tokens on business surfaces.
- [x] Action labels describe their object; errors explain a retry or correction.
- [x] Selection counts use tabular numbers. User titles remain unmodified.

Color and surfaces:
- [x] Semantic colors; meaningful selected/status colors with text or named states.
- [x] No decorative gradients or colored shadows added to business controls.
- [x] Real screenshot colors and supplied brand assets are retained.
- [x] Cards have borders; shadows are reserved for dialogs and floating action bars.
- [x] No new decorative icon tiles or nested cards. Actual media/type placeholders are content.

Layout and components:
- [x] One container/gutter per surface; aligned card columns and real row gaps.
- [x] Spacing uses the 4px rhythm, concentric preview radii, narrow-layout wrapping.
- [x] No comparison tables requiring a scrolling table wrapper.
- [x] Official free Arc items wherever compatible; documented props, no internal restyling.
- [x] Tabs switch import panels; segmented controls filter one collection.
- [x] One primary action per task surface; no Pro reconstruction.

States and motion:
- [x] Loading skeletons, useful empty states, inline failures with retry,
  in-place copy/save feedback and guarded busy controls.
- [x] Long titles wrap or truncate with the full value reachable by title/focus.
- [x] Shared motion tokens; transform/opacity transitions, faster exits,
  reduced-motion branches and stable record keys.
- [x] Official Tabs may spring its panel height, which communicates a changed panel.
- [x] Browser-only reads occur in effects/handlers, not added to first React render.

Accessibility and responsive:
- [x] Shared foundation keyboard focus; no new handmade focus ring.
- [x] Real controls, associated labels, headings, specific icon names and live statuses.
- [x] Dialog modality, Escape and focus return tested; underlying controls stay inert.
- [x] State is not color-only; async feedback is announced.
- [x] Required responsive widths and light/neutral plus dark/blue checked.
- [ ] Universal 44px touch targets: desktop compact controls remain 36px,
  approved folder close target 32px and official SearchField clear control 24px.
  The extension expands compact actions on coarse pointers. This Windows-first
  release does not claim touch-first/mobile conformance or fork Arc internals.

## Intentional exceptions and limits

- Approved frosted folder artwork, small optical close treatment, PNG brand
  dimensions and 17px native compositor clipping are brand/platform exceptions,
  not rules for all Arc controls. No folder redesign was made in this pass.
- The thumbnail encoder retains its white bitmap fill when flattening a captured
  image to JPEG. It is image data, not an independent business UI color token.
- Deleting a local reference has no Undo yet and may discard local note content.
  Desktop confirmation explicitly explains the effect and original bookmark
  preservation; extension uses inline Delete/Keep confirmation. This pass does
  not claim a completed reversible-delete UX.
- Plain-HTML extension controls are adapters to the design language, not claims
  that React Arc components run inside the extension. Native select/dialog retain
  browser keyboard behavior. Codex's own chrome is outside StashDock's control.
- Screen-reader speech, all physical DPI/multi-monitor configurations, very large
  collections and a real installed-extension capture were not exhaustively tested.
- MSVC emits missing-debug-PDB LNK4099 warnings; release and tests still succeed.

## Packaged artifacts and deployment status

- New executable: `src-tauri/target/release/stashdock.exe`.
  SHA256: `85BD0EFE41EAD72A51C6CE0B5AD308EE669E69E328E95C2685EBD88C2884F953`.
- Installer: `artifacts/StashDock_0.2.1_arc-surfaces_x64-setup.exe`.
  SHA256: `8E0D110CE032035C92F5A18F2DB985C38036EE5A5B9315197F139B62275F548E`.
- The first attempt to replace the running root executable was rejected by
  execution policy and did not run. After the user explicitly exited from the
  tray, process absence was verified and deployment completed without forcibly
  terminating any process. `D:/StashDock/stashdock.exe` now matches the verified
  release SHA256 above.
- Previous executable is preserved at `artifacts/stashdock-before-arc-surfaces.exe`
  (SHA256 `FB3FB826D99D5C9D2C6F33050BC8E9DCF231878EE0F1F74B728D3918EC5578D7`).
- Real bridge read-only checks before/after packaging report 29 references and
  15 previews. UI mutations were limited to synthetic browser fixtures.
- Real Windows GUI smoke test completed on the deployed binary: startup shows
  the folder; pointer actions open Dock, expand Library, open the import dialog,
  shrink to Dock and collapse to the folder. The stable import dialog is opaque
  and centered inside the visible Library pane. Tab interaction was exercised;
  Escape closes the dialog. No real import or deletion was performed.
- Folder close hides the native window (it becomes unavailable to window capture)
  while the process and bridge remain available. Reopening the executable restores
  the folder in the same process, without creating a second instance. The final
  running process was PID 29080; the visible folder was left open for the user.
- Final read-only bridge checks still report 29 references and 15 previews.
  Native smoke testing did not change clipboard contents or collection data.
- Remaining user steps: Reload the unpacked browser extension and refresh the
  Codex Dock page. Real installed-extension capture, screen-reader speech and all
  physical DPI/multi-monitor configurations remain outside this smoke test.
