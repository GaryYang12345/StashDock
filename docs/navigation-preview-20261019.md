# Navigation, drag boundaries and Markdown preview

## Confirmed cause and changes

- Desktop retained the Files collection when selecting a tag. The intersection
  could hide tagged web references, while clicking the selected tag again
  cleared it and revealed the old collection. A session navigation update now
  publishes collection/tag together. Tag selection means All + that tag;
  collection selection clears the tag. Reselection is a no-op.
- Sidebar and shared tag-menu entries select their destination instead of
  toggling it off. MCP uses one collection/tag state object with the same rules.
  Existing request-generation guards continue to discard superseded reads.
- The white content toolbar no longer starts native window dragging. Only the
  grey title bar and grey navigation background are drag surfaces. Interactive
  controls remain excluded.
- Both hosts use the same ContentEditor preview button, Arc scroll area and
  Markdown renderer. Edit/preview keeps the textarea mounted, preserving the
  draft, selection and edit scroll. Save still submits the unchanged draft.
- react-markdown + remark-gfm render Markdown without raw HTML or executable
  URLs. Images display their alt text instead of issuing automatic network
  requests. No parsing occurs while typing in edit mode. The build retains the
  original notices for the 74 Markdown packages actually bundled.

## Verification

- 344 frontend tests pass, including 30 rounds of atomic mixed navigation,
  idempotent reselection, Markdown features and unsafe-content rejection.
- Native suite: 146 pass, one existing system-clipboard test ignored.
- Production browser fixture: 12 actual Files -> Codex -> Codex cycles always
  show both tagged references (one file and one web reference).
- Actual edit/preview roundtrip preserves a modified draft and its cursor;
  Cancel closes without saving. Light/neutral and dark/blue reviewed.
- At 390, 768, 1024 and 1440px, the preview dialog and Save action fit, with no
  horizontal page overflow.
- MCP development harness, using a separate three-reference SQLite library:
  Files -> Codex shows both tagged references; reselection remains Codex; the
  shared Markdown preview renders the hydrated context. This is a harness, not
  an automated interaction with the real ChatGPT composer.

Recovery executable/source: `artifacts/before-navigation-preview-20261019`.
Logs: `output/navigation-preview-*.log`.

## Packaged native deployment

- Desktop executable installed and opened with embedded `tauri.localhost`
  assets. SHA-256: `e8454177fd11d056b2eb340a170e0eb6a318d338240aeba87f47a3355d3ba126`.
- Actual installed Desktop: Files -> pinned Codex shows both a web reference
  and a Markdown reference; selecting Codex again keeps both cards visible.
- A drag starting over the white content header left the window position
  unchanged. The grey-surface handler still invokes the native dragging API,
  with interactive controls excluded. The automation tool's short native drag
  did not reliably demonstrate sustained grey-titlebar movement; manual
  physical-mouse verification remains necessary. Do not call that check passed.
- Plugin ZIP: `output/releases/stashdock-plugin-0.4.27-win32-x64-navigation-preview.zip`.
  Its 185 manifest files passed hash verification and actual bundled Node
  startup with PATH empty, tool/UI discovery, isolated-library read, webpage
  lookup and PDF rendering. All 182 plugin files in the installed cache match
  the release. Old generated engine caches were not deleted.
- Native installer: `src-tauri/target/release/bundle/nsis/StashDock_0.2.5_x64-setup.exe`.
  Source and installed cache updated; existing host panels must reopen to load
  the new HTML. No references were saved, edited or deleted in the real library
  during these checks; draft edits were confined to the isolated fixture.
