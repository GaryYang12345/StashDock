# Desktop tag input and sidebar

Scope: Windows standalone application only. Codex MCP App source and installed
bundles are unchanged. No reference metadata or stored tags are removed.

## Changes

- Screenshot tag badges removed from desktop cards, in grid and list view.
- Official free Arc Tag Input installed through the registry, without modifying
  its source or CSS. Controlled values keep validation and library tag spelling.
- Existing tags appear beneath the field as Arc secondary buttons with a plus.
  Selecting adds the tag and removes it from suggestions; removing restores it.
- Enter/comma, removal, duplicate feedback and blur follow the upstream component.
  Save includes an uncommitted draft and preserves unrelated reference fields.
- Collections remain fixed. Pinned and Tags share one Arc ScrollArea with a 24px
  edge fade only where more content exists. Nested scroll containers removed.
- Disclosure headers share the collection row grid, icon size and button density.
- Context shelf toolbar uses the same surface as the main content. Only the
  titlebar and sidebar use the muted surface.

Reference: [Arc Tag Input](https://uiarc.dev/components/tag-input).

## Verification

- TypeScript build and extension canonical-asset check pass.
- 144 frontend tests pass.
- Isolated browser dashboard regression covers 320, 390, 768, 1024, 1180 and
  1440px, light/neutral and dark/blue; default three columns, narrow one column.
- Browser tag input fixture checks existing selection, case-insensitive duplicate,
  Enter/comma, blur, draft-on-save, invalid length, removal and re-addition.
- One sidebar scrollbar verified, header icon/text edges aligned to under 1px,
  fixed collection navigation preserved during scroll, both fades measured 24px.
- Editor keyboard dismissal, return focus, tag context menus, rename/remove and
  Pinned persistence are covered. Reduced-motion interaction is covered.
- Native-pane browser fixture uses simulated Tauri at scale factor 1.5 with a
  1062 × 684 pane. This is not a physical Windows pointer gesture test.
- Browser tests clone read-only saved examples into isolated fixture data. No
  user database writes occur. Screenshots are under output/playwright.

## Arc review

- [x] Existing official free components, documented props and installation
- [x] Single foundation import; no vendor source changes or Pro imitation
- [x] Semantic surface/type/spacing tokens, sentence case and minimal copy
- [x] Controlled state, canonical validation, promise-backed save and inline status
- [x] One main Save action; named secondary/removal controls
- [x] Stable animation keys, wrapping layout and reduced-motion behavior
- [x] Both themes and neutral/blue accents; responsive layout checks
- [x] No custom rings, raw colors or decorative gradients in changed business CSS
- [x] Scroll fades use the upstream accessibility-preserving mask, not overlay copy

The official Tag Input retains its upstream chip hit-targets and focus treatment,
per the user's request to match that component. Mobile touch certification and a
live screen-reader audit are not claimed. The repository has no lint command;
type checks, source sweeps and the test suites provide the automated checks.

## Deployment

Windows release and NSIS installer built successfully. Embedded brand icons match
at all nine raster sizes. Only the exact-path standalone StashDock process was
stopped; the new EXE was installed and restarted from D:/StashDock/stashdock.exe.
Recovery copy: artifacts/stashdock-before-tag-input-sidebar-20261010.exe.
Installed/release SHA-256:
`EADC3D3AB75D6327F89B1CCCB5E339991D08D48A6E59A539C121DDA67A4A2D7C`.

Health and the trusted references endpoint respond successfully after restart.
All 29 reference records and Pinned metadata match fresh pre-replacement hashes:
rows `6621f6a581f2eecec350c8c3df0dbe1560c4c1d6286ba7727acc41998fb7aaa1`,
Pinned `f9c40c5c427668047ecf01e304dd80f96179b38d1281d421e4842cec65937084`.
Codex source and installed 0.4.3 UI/server bundle hashes remain unchanged.
Own test browser contexts, browser session and preview server were closed.
