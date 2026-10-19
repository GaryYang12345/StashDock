# Window controls fix verification (2026-10-08)

## Changes

- Removed the compact Dock's saved-reference count subtitle.
- Refresh is now the right-hand action beside the collection segmented control, not a titlebar action.
- Shared window controls have fixed 36px targets, 16px glyphs, neutral hover/press feedback, explicit disabled state while switching, and a pointer-down boundary that cannot initiate titlebar dragging. Close has the same neutral treatment as minimize/resize.
- Surface animations still normally take 260ms. A separate 1200ms settlement watchdog commits the final geometry if completion notifications are suspended; it is not an extra animation or a normal click delay. Rejections still roll back, and timers are cleared.
- Native final panel regions now use a validated, DPI-scaled round rectangle; the folder and transition envelope keep their rectangular region. CSS layers and the transition paper also have explicit rounded clipping. Panel radius has a shared 17px source.

These fix concrete hit-target, transition recovery and clipping weaknesses. The user's intermittent multi-click failure was not conclusively reproduced before modification; the watchdog should not be described as its proven sole cause.

## Verified

- 49 frontend tests passed. New cases cover shared control semantics/neutral styles, refresh placement, clip paths, rounded region arguments, missing animation completion, rejected animations and rounded rollback.
- 19 Rust tests passed, including 100%/150% radius geometry, invalid radii and backward-compatible default radius.
- TypeScript/Vite and release executable/NSIS build succeeded. The root executable and release artifact hashes match; the preceding root executable is preserved as `artifacts/stashdock-before-window-fixes.exe`.
- Browser workbench replay: `scripts/verify-window-controls.js`. The first phase checks the real embedded Dock through its read-only bridge. The second phase mocks native commands in an isolated browser, uses the actual FloatingShell, and never connects those fixtures to the desktop library.
- Seven pointer resize cycles passed in the browser harness; an outer-edge click on the 36px resize target worked; no control click invoked native dragging. Hover colors matched for resize and close after the color tween settled.
- A simulated native region failure rolled back and permitted the next click. A simulated never-resolving animation completion recovered to the library with its final rounded region.
- The new native application was launched and its compact panel visually inspected: no count subtitle, refresh beside filters, consistent controls, rounded transparent corners.
- Native Ctrl+K focused search; reverse tab navigation visibly focused the resize control, and Enter opened the full library. The same keyboard path activated Shrink to Dock. Both final forms and their corners were inspected in the real WebView.

Browser screenshots are in `output/playwright/dock-header-fixes.png` and `output/playwright/window-controls-fixes.png`. Native captures were inspected directly through computer-use, not saved as additional assets.

## Boundaries

- Browser native calls are fixtures, not proof of Windows move-loop behavior. Actual 100% DPI/native multi-monitor stress and frame-by-frame transition profiling remain unmeasured.
- The user's active window moves and the capture helper's transparent-window coordinate errors prevented a reliable native mouse stress sequence. Do not count those rejected tool inputs as application clicks or claim that every intermittent native failure is eliminated.
- Existing folder artwork, collection data, card design and native drag engine are retained. No saved collection was added, removed or changed by these tests.
- Arc review: the changed header compositions use documented existing Button/SegmentedControl props and semantic tokens; shared control feedback uses the foundation focus style and reduced-motion CSS. This is a scoped desktop repair, not a claim that legacy rows/other product views meet the full Arc checklist. Desktop targets are 36px rather than the 44px touch baseline; the broader baseline exceptions remain in `arc-baseline-verification.md`.

The already-open embedded browser page must be refreshed to fetch the new packaged assets; otherwise it can continue showing the old titlebar.
