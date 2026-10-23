# Arc baseline verification

Checked on Windows, 2026-10-08. This is the foundation and header migration, not a claim that the whole product now meets the Arc checklist.

## Implemented scope

- Application imports use `motion/react`; `motion@14.0.0` has a single internal `framer-motion@14.0.0` dependency. No separate direct Framer Motion dependency remains.
- Ordinary UI icons use Lucide. User brand assets and the approved monochrome folder geometry/material remain; only its link glyph uses Lucide.
- Official free Arc foundation, Button, CopyButton, SearchField, SegmentedControl, Card and Dialog were installed with the shadcn CLI. Source is kept as CLI-generated; there is no reconstructed Pro source or runtime Arc service.
- Main toolbar and compact Dock header use Arc Button/SearchField/SegmentedControl. Existing controllers, copy payloads, Ctrl+K, native drag exclusions and window controls are retained.
- `/design` is a lazy-loaded, read-only component workbench. It reads real saved records through the existing bridge and displays up to four matching references, not a second library or a cloud upload.
- Arc foundation is imported once; Inter and Geist resources are local. Old global press styles exclude Arc surfaces so transforms have one owner.
- The native FloatingShell, region calculations, native drag engine, persistence and extension/MCP protocols were not rewritten. Native import dialogs still use the existing panel-relative FluidDialog; official Arc Dialog is only used on the browser workbench.
- Arc/Motion/Lucide and font license texts are included in `public/licenses`, copied into the built frontend, and listed in `THIRD_PARTY_NOTICES.md`.

## Verification actually run

| Check | Result |
| --- | --- |
| `npm run test:frontend` | 42 tests passed, including 6 new foundation/semantic markup tests |
| `npm run desktop:test` | 17 Rust tests passed |
| `npm run build` and `npm run desktop:build` | TypeScript, Vite, release executable and NSIS installer succeeded |
| Browser search/clear | Real reference titles filter and restore results |
| Grid/List keyboard selection | Roving focus and arrow selection verified |
| Browser modal | Tab stays inside, Escape closes, focus returns to trigger |
| Clipboard | Structured context success and simulated permission rejection both announce the correct status; denial is not presented as success |
| Connection failure | Aborted items request shows actionable error; Retry restores actual records |
| Empty search | Clear restores records; copying an empty selection is disabled |
| Widths | 320, 390, 768, 1024 and 1440px: no horizontal page overflow |
| Theme samples | Light/neutral and dark/blue inspected; preview toggles do not enable whole-product dark mode |
| Local fonts | Browser FontFaceSet confirms Inter and Geist loaded on the workbench |
| Reduced motion | Grid/List and modal interactions exercised with reduced motion enabled |
| Embedded Dock | 420px view, actual saved references, search/clear and Ctrl+K exercised |
| Native desktop at current 150% scale | Folder opens, search filters/clears, full library opens, import modal appears within its panel and closes on Escape, library shrinks to Dock, Dock collapses to folder |

The browser replay is `scripts/verify-arc-browser.js`, run through the Playwright CLI's `run-code --filename` option. It requires the desktop bridge and populated library. Clipboard checks use the isolated test browser context and temporarily simulate write denial; no saved record is edited or deleted. Additional offline/reduced-motion checks were run interactively. Screenshots are under `output/playwright` (ignored build artifacts).

The user library remained at 26 records, 12 with previews, throughout these checks. No import, delete, favorite change or agent message was submitted during verification.

## Build footprint and limits

The measured main JS chunk is 433.81 kB / 140.26 kB gzip, versus the immediately prior local build's 441.17 kB main chunk. The workbench is a separate 58.79 kB / 19.93 kB gzip lazy chunk; it is not loaded when the native folder opens. This is a bundle observation, not a measured FPS improvement.

No continuous frame trace, 500-record performance run, 100% DPI run or numeric contrast audit was performed. No blanket claim of 60fps, zero transition flashes, complete accessibility or whole-product Arc compliance is made.

## Arc review

This review applies to the new workbench and migrated header compositions. Official component internals and retained business views are distinguished below rather than silently marked compliant.

### Type and copy

- [x] New authored UI copy is sentence case, with no uppercase transforms.
- [x] No new heading eyebrow/overline.
- [x] New authored copy has no em dashes or heading trailing periods. Original saved titles/excerpts are not rewritten.
- [x] New composition uses weights 400/500 and Arc size tokens.
- [x] Action labels name their object where needed; connection errors give a recovery step; copy status reflects real results.
- [x] Changing counts use tabular numerals.

### Color and surfaces

- [x] New composition CSS uses semantic tokens, not raw hex/ramp/Tailwind colors.
- [x] Accent represents selection/emphasis; theme previews are explicitly labeled.
- [x] Status has accessible text, not color alone.
- [x] No new decorative gradients/glows in ordinary controls. The approved folder's material is an intentional brand exception.
- [x] Real screenshots and existing user brand are used; third-party content is not recolored.
- [x] Workbench cards use official borders; shadows are reserved for floating layers.
- [x] No decorative icon tiles or nested cards were introduced.

### Layout

- [x] One workbench container, with no double gutter.
- [x] Section heading and reference cards share a left edge.
- [x] Grid siblings share their row height and media ratio, with genuine gaps.
- [x] New composition does not override official internal radii.
- [x] New composition spacing uses the 4px token grid; compact header uses 16px padding.
- [x] No new table or viewport-width overflow.

### Components

- [x] Six official free component types are demonstrated; applicable header controls use official primitives.
- [x] Segmented controls switch views/filters, while export uses a dialog; no fake tabs.
- [x] Only documented props are used; no restyled component internals or invented portal prop.
- [x] Each surface has at most one primary action.
- [x] No Pro source is reconstructed.
- [ ] Retained sidebar, StashCard/Dock rows, ContextBar, import form and extension still need their planned component migration. These are explicitly outside this baseline pass.

### States

- [x] Loading, no results, empty library, actionable connection failure, in-place copy success/failure and disabled copying are represented.
- [x] Real long saved titles/excerpts are reachable without rewriting them.
- [ ] Initial loading is a reserved text/status area, not a final-layout Skeleton yet. Skeleton/Alert/EmptyState adoption belongs to the next business-view pass.

### Motion

- [x] Arc controls use their official shared motion helpers. The existing native 260ms transition is intentionally retained for the fixed transparent window engine.
- [x] No new JavaScript frame loop or competing global transform was introduced.
- [x] Selected backgrounds settle without added playful bounce.
- [x] Stable keys preserve existing content; no whole-page remount animation.
- [x] Reduced-motion branch exercised for the new controls.
- [ ] Official CSS includes tokenized border/color transitions; retained native shape changes and existing business animations have not all been re-audited against Arc's transform/opacity-only rule.

### React correctness

- [x] Workbench first-render logic has no browser globals/random/time output; browser-only theme mutations run in effects.
- [x] Animated records keep stable item IDs.
- [ ] Counts use tabular digits but do not all reserve a maximum-width slot yet; this remains a next-pass layout refinement.

### Accessibility

- [x] No new hand-made focus ring; shared Arc foundation is loaded. Official SearchField owns its focused shell styling.
- [x] Search labels, buttons, headings, links and page landmarks are semantic.
- [x] Icon-only actions have specific accessible names.
- [x] Browser dialog traps/returns focus and closes on Escape; retained native import modal was checked for placement/Escape.
- [x] Copy status is announced; state is not conveyed by color alone.
- [ ] A new native Arc portal adapter is not implemented. Native modal focus behavior remains the existing implementation, not a certification of the browser Dialog in WebView.

### Responsive

- [x] Required 390/768/1024/1440 widths and extra 320 width rendered without sideways page scroll.
- [x] Light/neutral and dark/blue workbench variants read correctly in inspected screenshots.
- [ ] Not every target is 44px: the official SearchField clear button is 24px and retained window controls are compact desktop controls. This first target is Windows pointer/keyboard; a touch-density variant remains to be designed, rather than locally forking official internals.

## Next bounded pass

Migrate the actual reference card/list and sidebar, followed by import form/feedback and the extension's shared tokens. Keep library actions and native window engine separate from visual primitives. Product dark mode, touch density, native Arc portal support and quantitative performance/contrast checks require their own verification.
