# Desktop tags and card polish (2026-10-10)

Desktop only. Codex MCP App bundles and installed 0.4.3 plugin are unchanged.

- Image action buttons use a lighter neutral protected surface and subtle edge.
  Selected control becomes solid (white in light, theme surface in dark).
- Tags use an opaque semantic surface and edge for white, gray, dark and fallback
  previews. No whole-image scrim, gradient, per-card blur or continuous sampler.
- Desktop selection/drag bar caps at 560px rather than 720px.
- Pinned sits above Tags. Both disclose independently. Pinned tags remain in Tags.
  Right-click Pin/Unpin, Rename and Remove. Removing a tag never deletes cards.
- Desktop pin preferences persist in SQLite app_meta. Toggle uses a transaction
  and current records; rename/remove updates references and pins atomically.
  Browser test preferences use isolated localStorage, not the user's library.
- Card right-click and three-dot menu both contain just Edit card. One form edits
  title and tags without rewriting saved content, favorites or assets.
- Add tag searches existing names and offers Create for a new name. Names are
  validated and selected values have a stable, accessible remove button.
  Focus restoration from an outgoing modal does not steal a new modal's focus;
  transient focus-guard blurs do not commit a tag or detach a live option.
  Redundant editor subtitle, long helper copy and sidebar footer were removed.

## Arc choices and review

Used existing Arc Button, Input, Alert, Dialog, ScrollArea, menu presentation and
the official Combobox, with its documented callbacks and native input props.
The stock TagInput clipped long values' remove controls at 390px; the MultiSelect
registry request stalled and was cancelled. Neither component's source was
imitated or forked. Application-specific tag composition uses Arc Button and
Combobox, with ellipsized content and full accessible button names.

- [x] Type/copy: sentence case, no extra explanatory paragraphs, consistent names.
- [x] Color/surfaces: semantic roles, no new raw colors or decorative gradients.
- [x] Layout: three default columns preserved, 4px rhythm, existing container.
- [x] Components: public props, real saved examples in isolated test storage.
- [x] States: error, pending and saved feedback in place; invalid tags recover.
- [x] Motion: original Arc movement/reduced-motion behavior preserved.
- [x] React: stable keys, queued pin mutations, no first-render browser reads.
- [x] Accessibility: named controls, one Edit card action, focus/Escape preserved.
- [x] Responsive/themes: light/neutral and dark/blue, narrow through wide widths.

136 frontend tests and 36 native tests passed. Type check, frontend build and
extension UI asset consistency checks passed. No lint command is configured.
Browser checks passed at 320/390/768/1024/1180/1440 in both tested themes, with
three default columns, pin/rename persistence, existing-tag picking, creation,
card context menu, editor focus return, and tag removal retaining all cards.
White/gray/black/fallback screenshot examples confirmed protected tag surfaces,
solid selected control, 560px bar cap, invalid-tag recovery and long-tag removal
at 390px. All examples used isolated browser storage; no saved user rows edited.
Live screen-reader and actual native pointer automation are unavailable; browser
flow checks simulate the visible native pane and do not claim native OS coverage.
This iteration targets Windows pointer/keyboard use. Removable tag buttons use
Arc's 36px desktop density; live touch-target testing is not claimed.

Design sources: [Arc Combobox](https://uiarc.dev/components/combobox),
[Material image text protection](https://m1.material.io/style/imagery.html).

## Deployment

Windows release and NSIS installer built successfully. Embedded brand icon
matched at all nine sizes. Replaced only `D:/StashDock/stashdock.exe` and restarted
that verified process; previous EXE is recoverable at
`artifacts/stashdock-before-pinned-tags-20261010.exe`.
Installed/release SHA-256:
`821911F6BA69737C87AE3A5FD8B02C33C8CE5B04A53D02A3FAB13522E3D46EED`.
Post-restart health returned ok and trusted items API returned HTTP 200 with 29
references. All saved rows matched the pre-replacement SHA-256 exactly:
`075a67e2861b8deb08753339bce5f06ead5040a81f502d4a98ed4c35f818e29b`.

Own browser, test contexts and preview server were closed. Codex plugin UI/server
bundle hashes remain identical to the installed 0.4.3 copies.
