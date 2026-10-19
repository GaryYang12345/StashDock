# Product polish 0.4.20

## Corrected intent

The previous fixed-height import solution was a UX regression. Import now follows actual header/body measurements on Arc's interruptible, non-overshooting smooth spring. The centered outer frame interpolates continuously, without scaling the text or running a competing panel-height animation. Available native/browser bounds still constrain long content. The shared header gutter stays 24px (16px at narrow widths).

File has the same explicit Save action as Link and Note, disabled before selection. Selection stages metadata, never saves implicitly. The redundant trailing Browse label is omitted. This uses a small, default-preserving `showBrowse` composition prop added to the installed Arc FileUpload; it is an intentional product-specific extension, not an assertion that upstream Arc exposes that prop.

Desktop now groups the grey sidebar/top chrome around a white rounded content surface with a subtle semantic resting shadow. Shell dividing lines are removed. Window controls use visibly different semantic hover/pressed fills. Labelled copy actions keep their accessible names without redundant tooltips.

Shared card menus have controlled open state and cross-instance dismissal. A new menu closes the previous one; closed exit layers are inert/hidden to assistive technology and cannot steal focus from a replacement menu or editor.

## Verification

- TypeScript and 198 frontend/server tests passed; 69 native tests passed.
- Six desktop import switches sampled over 96 intermediate frames. Initial Link/Note/File measured 322/596/346px, rather than a fixed frame; no height overshoot or uncoordinated vertical center. File explicit Save closes. Four consecutive card menu openings retained only one actionable menu and one raised card.
- Multiple staged file edits persist on explicit Save; normal link/file forms fit desktop bounds without scrolling to Save.
- Existing tags checked at 320/390/768/1024/1440, including native scaled collision, typing without opening, retained suggestions, Escape/focus return and save/close.
- All active desktop edit/confirmation headers checked across 40 theme/width combinations, plus five scaled native boundary checks.
- Native import rapid reversals stay inside the visible pane; Save is reachable; reduced motion still uses content-sized frames without travel.
- Dashboard rendered at 390/768/1440 in light/dark with neutral/blue accents: rounded content, subtle shadow, no page overflow, distinct window hover. Screenshots visually reviewed.
- MCP sidebar/full-view light/dark checks verify content-sized dialogs, initial file Save, omission of Browse, menu exclusivity and reduced motion.
- Full MCP import regression passed 20 theme/accent/width combinations, browser import/manual link/staged file/note, responsive grid/list and untouched test draft. Writes were confined to a fresh isolated `mcp-test-` database.
- Arc checklist: shared components/tokens, type/copy, layout, controlled states, pointer/keyboard semantics, focus, reduced motion, responsive widths and both themes reviewed. No live screen-reader session or native OS screenshot automation was available; native scale/portal behavior was rendered in the actual adapter fixture, not claimed as an OS screenshot.

## Deployment and recovery

MCP 0.4.20 installed, resource `ui://stashdock/shelf-v22.html`, installed read-only protocol smoke passed. Production native build and branded icon validation passed; desktop restarted from `D:/StashDock/stashdock.exe`. Deployed/build SHA256: `913EEFEE873962CB803413C3EE6E2E54982CB8CFB4A9F40A180143E62AF4D103`. Local health `ok: true`.

Recovery: `artifacts/library-before-0420-polish.sqlite3`, `artifacts/stashdock-before-0420.exe`. After deployment: 39 references, rows fingerprint `bc947a79100e46202dd9eff5e9ab5a2e12ed2f5c3073885ca7c204386c918614`, pinned fingerprint `631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864`, both unchanged.
