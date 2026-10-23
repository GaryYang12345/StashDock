# Fixed tag navigation and modifier focus

Scope: standalone Windows application. Codex MCP App source and installed bundles
are unchanged. Existing Pinned storage, tag metadata and reference data remain.

## Changes

- No Pinned disclosure, heading, count or separate nested group. Pinned tags are
  direct rows after Favorites in the fixed collection navigation, using the same
  Arc Button, row grid and moving selection indicator.
- Pinning order and canonical tag spelling are retained. Namespaced row IDs and
  React keys avoid collisions with collection IDs. The Tags list remains intact;
  both locations offer Unpin tag, Rename tag and Remove tag through the existing
  Arc/Radix menu adapter. Only Tags owns the fading sidebar scrollbar.
- Reproduced bare Shift turning a mouse-focused disclosure into Chromium
  `:focus-visible`, producing a dark 2px outline without any navigation.
- A desktop-only input modality adapter enables Arc's shared focus outline for
  intentional navigation/activation, not bare Shift, Control, Alt or Meta.
  Pointer presses reset the modality. Only the documented focus-width token is
  adjusted: no vendor CSS fork or custom outline, no preventDefault, no blur.
- The same modality covers folder controls, toolbar, cards and body/native
  portaled dialogs. Bare modifiers also cannot reveal off-hover card actions.
  Tab and Shift+Tab still navigate, menus retain their highlight and fields
  retain caret/border feedback. IME composition does not change modality.

## Verification

- TypeScript check and 149 frontend tests pass, including focus-modality listener
  cleanup, pointer reset, modifier handling and genuine keyboard navigation.
- Isolated browser test checks fixed rows/order, filtering, pin/unpin, unchanged
  Tags entries, single scrollbar, scroll stability, reload persistence and no
  modifier-created outlines after clicking sidebar, view toggle, search, card
  selection/favorite controls and after returning from an editor.
- Tab focus remains visible. Tested light/neutral and dark/blue at 390, 768,
  1024 and 1440px without page overflow. Dashboard regression additionally
  covers 320px, tag rename/remove, card edit persistence and focus return.
- Simulated native pane at scale factor 1.5 retains 1062 by 684 geometry, contained
  editors and unchanged folder anchor. This is not physical Windows pointer
  or assistive-technology certification.
- Screenshots: output/playwright/pinned-fixed-light.png and pinned-fixed-dark.png.
- Existing official Arc components and vendor sources are unmodified. Reference:
  [Arc Button](https://uiarc.dev/components/button).

## Arc review

- [x] Existing free components, documented props and platform adapters only
- [x] Single foundation, semantic tokens, unchanged text and spacing rhythm
- [x] Named navigation, canonical real data and promise-backed pin persistence
- [x] No ornamental headings, new rings or pointer-focus outlines
- [x] Keyboard focus, menu/dialog dismissal and reduced-motion behavior retained
- [x] Responsive geometry, two themes/accents and long tag names reviewed

The repository has no lint command. Type checks, CSS/source sweeps and the
automated suites are used; live screen-reader and touch audits are not claimed.

## Deployment

Release and NSIS installer built successfully; all nine embedded brand icon
sizes match. Verified the exact standalone process path, replaced only the EXE
and restarted with D:/StashDockData. Release/installed SHA-256:
`287234CBCE3809ED87A48B45621F018D83873B03ACC0605817E43975649A4442`.
Recovery: artifacts/stashdock-before-fixed-pins-focus-20261010.exe.

Health is successful with 29 references. Fresh pre-replacement and post-restart
record and Pinned fingerprints match:
rows `6b87c911ab24c5943b12ce18d693e9fd0f0414daad814af84ae48ae6cc683df5`,
Pinned `f9c40c5c427668047ecf01e304dd80f96179b38d1281d421e4842cec65937084`.
Codex source and installed 0.4.3 UI/server hashes remain unchanged. Own test
browser session and preview server are closed.
