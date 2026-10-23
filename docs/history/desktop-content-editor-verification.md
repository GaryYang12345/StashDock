# Desktop content editor

Scope: Windows standalone application only. Codex MCP App source and installed
0.4.3 bundles are unchanged. Browser checks use isolated fixture storage, never
the user's database.

## Changes

- Tag Input hint is `Press Enter to add a tag`. Commas remain ordinary text;
  the application adapter also avoids committing during IME composition.
- Existing tag suggestions remain below the field after addition. Selected
  suggestions have a check and cannot be added twice; removing a chip enables
  its suggestion again. Canonical spelling and the 12-tag limit are preserved.
- Successful metadata, tag-name and content saves close their dialogs. Failed
  saves keep the draft and show the inline error. Pending saves block dismissal.
- Card ellipsis has `Edit card` and `Edit content`. The earlier single-action
  card right-click menu remains unchanged.
- Edit content uses the installed official Arc Textarea with a wider, responsive
  native-portaled dialog. Body whitespace, blank lines and Unicode are retained.
  Cancel does not write. Saved content is used by copy, native file drag and
  search; title, tags, URL, preview, original assets and favorites are preserved.
- Empty content is allowed and clears the derived excerpt, preventing fallback
  from resurrecting old text. Native persistence updates content/excerpt/FTS in
  one transaction. The stored-body limit is 200,000 UTF-16 units.
- The existing 20,000-character AI export limit and metadata envelope remain.
  Full stored text stays editable; only long bodies show the necessary limit
  notice. Original managed files and screenshots are not rewritten.

References: [Arc Tag Input](https://uiarc.dev/components/tag-input),
[Arc Textarea](https://uiarc.dev/components/textarea).

## Verification

- TypeScript check passes; 147 frontend tests and 38 native Rust tests pass.
- Content tests cover persistence, search/copy, empty body, validation, Unicode,
  save failure and transaction rollback after a failed FTS update.
- Isolated browser tests cover both ellipsis actions, comma-as-text, persistent
  suggestions, successful-save dismissal, focus restoration, copied body,
  search, reload, cancel, simulated storage failure and empty body.
- Content editor has no horizontal overflow at 390, 768, 1024 and 1440px in
  light/neutral and dark/blue. Dashboard regression covers 320 through 1440px,
  selection/tag management and existing card editing. No page errors observed.
- Simulated Tauri window at scale factor 1.5 preserves the 1062 by 684 pane,
  contains both editors, invokes the content command and preserves the folder
  anchor after collapse. This is not a physical Windows pointer gesture test.
- Screenshots: output/playwright/content-editor-light-390.png,
  content-editor-light-1440.png, content-editor-dark-390.png,
  content-editor-dark-1440.png and content-editor-native.png.
- Canonical extension assets match their sources; all nine Windows brand icon
  sizes match. No Arc vendor components or CSS were changed.

## Arc review

- [x] Official free components and documented props, no new dependency
- [x] Existing foundation, semantic tokens and shared button/form spacing
- [x] One primary save action, named field and secondary cancel controls
- [x] Controlled values and promise-backed saves with recoverable errors
- [x] Keyboard dismissal and focus return; pending-save dismissal guarded
- [x] Both themes, responsive geometry and existing reduced-motion adapter
- [x] No extra instructional copy for short bodies or decorative CSS

The upstream Tag Input keeps its standard chip hit targets, focus treatment and
blur behavior. Screen-reader and physical touch certification are not claimed.
The repository has no lint command; type checks and automated tests are used.

## Deployment

Windows release and NSIS installer completed successfully. Verified the exact
standalone process path before stopping it, replaced only the application EXE,
and restarted with D:/StashDockData. Installed/release SHA-256:
`DD8F79378611BC56BAD77918F0D79C75849F53700F65B94949D93EE2C1D97545`.
Recovery copy: artifacts/stashdock-before-content-editor-20261010.exe.

Health responds successfully and all 29 references remain available. Fresh
pre-replacement and post-restart record and Pinned fingerprints match:
rows `3a668430495ee6f76d1647a169d05b77b908b145a4bd52335a472ff35538ff61`,
Pinned `f9c40c5c427668047ecf01e304dd80f96179b38d1281d421e4842cec65937084`.
Codex source and installed UI/server hashes remain unchanged. Own test browser
session and Vite preview server are closed.
