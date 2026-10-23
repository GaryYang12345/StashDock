# Desktop tag picker and folder anchor

Scope: Windows desktop only. No Codex MCP App build or installation.

## Changes

- Arc Input plus installed free Popover and ScrollArea. Typing does not open a
  menu. The arrow opens a portaled picker beside the editor; Radix handles edge
  collisions and focus. Selection, Enter creation and saving a typed tag all use
  the existing tag validation. No vendor source modified.
- Card tags use a 60% translucent semantic neutral surface, with no border.
  This follows the user's explicit visual preference; universal image contrast
  is not claimed, particularly on similarly coloured screenshot backgrounds.
- Desktop default bounds are 1062 by 684 instead of 1180 by 760. The complete
  library layer, including its overlays, is rendered at 90%, preserving original
  content proportions and the default three-column grid.
- Expanded bounds have a 16 logical pixel work-area inset. The monitor is chosen
  at the folder's screen position, not from the much larger transparent HWND.
  Screen/canvas constraints use a uniform size fit rather than invalid negative
  native regions. The physical folder anchor is retained across open/collapse
  and titlebar movement. If a panel moves so far that its original folder lies
  outside the fixed canvas, a hidden restoration returns the folder there without
  trying to animate/expose an invalid region. No per-frame native work added.

## Verification

141 frontend tests and 36 native tests passed. Type check and canonical extension
asset checks passed; no lint command is configured.
Geometry regressions include four corners, 100/125/150/200% DPI, small work areas,
negative monitor coordinates, the folder-selected monitor, physical anchor
preservation after panel movement and hidden far-away restoration.

Browser checks use isolated storage or a simulated Tauri command layer. All real
reference API access is read-only and edits never reach the user's database.
The simulated native pane confirms 1062 by 684 rendering, three columns, picker
placement beside the editor, scrolling to the final tag, keyboard creation,
Escape closing only the picker, and matching folder coordinates after collapse.
Short-window picker checks at 440px height passed at 320/390/768/1440px in both
themes. On narrow panes, the placement axis changes to vertical before Radix
chooses top/bottom, so there is no off-screen, zero-width side picker.
The dashboard flow checks pin/rename persistence, shared card editing and tag
removal retaining references; theme/layout checks cover 320 to 1440px.

Actual native pointer automation and a live screen reader are unavailable; these
checks do not claim physical OS gesture coverage. Desktop 90% density follows the
requested proportional scale; mobile touch-target certification is not claimed.

## Arc review

- [x] Existing components selected, documented props and genuine reference examples
- [x] Official free Popover installed; foundation imported only once
- [x] Semantic tokens, established spacing/type, no new ornamental helper copy
- [x] Native portal/collision adapter; no source fork or imitation of Pro components
- [x] Keyboard controls, labelled input, in-place feedback, reduced motion retained
- [x] Stable state/keys, no synchronous browser reads on first render
- [x] Both themes and neutral/blue accents; constraints and long tags covered
- [x] User-directed translucent tags and proportional desktop density documented

Design reference: [Arc Popover](https://uiarc.dev/components/popover).

## Deployment

Windows release and NSIS installer built successfully, with matching brand
rasters at all nine icon sizes. Only the verified StashDock process was stopped;
the desktop EXE was replaced and restarted from `D:/StashDock/stashdock.exe`.
Recovery build: `artifacts/stashdock-before-popover-anchor-20261010.exe`.
Installed/release SHA-256:
`4CF780B10FBFAD0352CDC6FA5C5E436ED264CBE72F597679712262AAFE7766B9`.

Post-restart health is ok, the trusted references endpoint returns 29 records,
and all saved reference rows and Pinned metadata match their fresh pre-replacement
fingerprints. Reference rows SHA-256:
`7ac760039a3f7ff5df063c48db33ef6c4d1bc8192000a436baabac5ca844b4fb`.
Own browser/isolated contexts and preview server were closed. Codex source and
installed 0.4.3 UI/server bundles remain unchanged.
