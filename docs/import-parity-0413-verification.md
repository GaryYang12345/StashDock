# Desktop and Codex App parity, 0.4.13

## Root cause and correction

The desktop used DesktopImportDialog; McpShelf still used the legacy AddDialog.
The old importer required bookmark HTML and comma-separated tags, did not look
up link content, and could not save selected tags on files. Codex also lacked
the backend tools required by the new importer. An old regression explicitly
required the two importers to remain different; that assertion is corrected.

Both active product surfaces now compose the same import dialog and view toggle.
Only their service adapters and platform file pickers differ. The legacy browser
Dock is retained as archived-compatible code, not used by the MCP App.

## Code audit

| Region | Shared implementation / parity |
| --- | --- |
| Import types and forms | DesktopImportDialog: Link, Note, File; inline tab icons |
| Import from | Browser names and real logos, grouped profiles, selection, duplicate checks, favicons; no export HTML, search or batch tags |
| Manual links | Automatic title/content lookup, editable fields, existing tag suggestions, Enter-only tags |
| Notes and files | Tags, real content persistence, save closes the form |
| Grid/list | ReferenceViewToggle; MCP now includes both views |
| Card image/controls/footer | StashCard CSS, PreviewArtwork, SiteIdentity, CardActionLabel; same menu-open lift and inline source/action row |
| Card editing | ReferenceEditor, ContentEditor, referenceEditActions; exact final AI context |
| Tag editing | TagEditor and the same rename/remove operations |
| Selection | SelectAllReferences and shared ContextBar styles; count and Select all remain adjacent |
| Preview loading | Shared document skeleton, only when actual preview work is pending |
| Dialogs/buttons | FluidDialog and installed Arc primitives; no competing control styling |

Intentional differences remain: desktop pinned tags versus Codex's unpinned tag
menu; Copy for AI/native file drag versus Add to chat; native window/sidebar
versus the host panel; desktop three-card grid versus Codex's responsive
one/two/three-card grid. MCP file uploads retain their existing 5 MB/file,
10 MB/batch limits rather than silently pretending unlimited host uploads.

## Independent import backend

The MCP process reads known Chrome/Edge/Firefox bookmark profiles directly,
read-only. It does not require the desktop process, browser extension, or
exported HTML. Source IDs are rediscovered and cannot act as arbitrary paths.
Chromium favicons use the read-only browser cache when present. Firefox reads
a SQLite snapshot without copying a live database or closing the browser.

Link lookup parses public HTML without opening a browser or executing scripts.
Private addresses, credentials, nonstandard ports, private DNS answers and
private redirects are rejected; validated DNS answers are pinned to the HTTP
connection. Requests, redirects, bytes and concurrent work are bounded.
The App's readonly lookup tools return page details in app-only metadata, not
model-visible bodies. File tags are validated before any file is written.

Provider scope is Chrome, Edge and Firefox on Windows, matching the desktop.
Social-provider imports and authenticated-page access are not implemented on
either surface. Website screenshot generation still uses the existing desktop
preview worker; the independent MCP backend does not yet provide a separate
headless screenshot worker. Missing images are not falsely marked as loading
when no worker is running.

## Verification

- TypeScript build and all 182 frontend tests passed, including independent MCP
  import tools, file tags, cached favicons and public-network restrictions.
- Desktop browser fixture exercises grouped sources, selected import,
  saved-link exclusion, manual title/content edits, stale lookup, tags,
  files, notes, failure/retry, save-close, reduced motion and dark blue theme.
- MCP test host with an isolated database exercises the same import flows,
  data-URI browser logos, grid/list, both themes and neutral/blue accents at
  320, 390, 768, 1024 and 1440px. Actual file bytes and selected tags are read
  back from the isolated database. Test draft and attachments remain unchanged.
- Real public lookup smoke check: example.com returns its actual title/content.
- Built portable server and self-contained HTML; fresh plugin version/resource
  avoids overwriting the locked older plugin cache.

These tests use a local MCP host fixture, not Codex's real composer. Existing
Codex panels can retain their older connection until reopened with a fresh
plugin connection. User collection backups are made before deployment and
protected-content/pinned-tag fingerprints are compared afterward.

Deployment completed: plugin 0.4.13, resource `ui://stashdock/shelf-v15.html`.
Installed HTML SHA256 matches the generated file:
`3E547B8A5A3075F408F3F319D54EFF00C11040CE65E1723659DB46AC58B36076`.
Installed desktop executable matches the release artifact:
`C1F7BE8165046D694F1EAD2FE14D580A5ED2BEC0EA7D0069499B540638BF162B`.
Readonly installed-plugin smoke check passes and desktop health is OK.
The 33-reference protected-content fingerprint stayed unchanged before and
after deployment, as did the pinned-tag fingerprint. Both the database and the
previous desktop executable have recoverable backups in `artifacts/`.
