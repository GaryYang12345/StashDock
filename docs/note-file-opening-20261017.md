# Authoritative managed files

## Contract

All file-backed cards open the same managed file under the shared library's `assets` directory. Open never creates a temporary copy. Editing and saving that file externally changes what the next Open and original-file transfer use.

Note keeps its familiar creation form and visual identity, but its content carrier is now an ordinary `.txt` asset. Creation and the one-time legacy migration register that file before publishing its card. Desktop and the AI provider use the same asset path. SQLite stores metadata and a refreshable text/search projection, not another authoritative Note body. Files appear in the Files filter regardless of their presentation kind.

- Existing notes migrate their exact saved body, including intentional empty text, while preserving supplemental context separately. IDs, titles, tags, favorites and creation dates remain unchanged.
- Once registered, a missing or inaccessible original is never reconstructed from stale database text.
- External saves, including atomic file replacement, are reflected on refresh/focus, content reads and context preparation. Opening always reads the actual file directly through its default application.
- Card context editing is supplemental for every file, including Note. It never rewrites the original. Original content is edited through Open in its normal application. Note's creation form is only a convenient way to create a TXT file; no special post-creation editor or writer exists.
- Original body and annotations are both searchable for managed files. A web reference's final context override retains its existing final-payload semantics.
- Original-file resolution accepts a saved ID and validates the managed boundary. No arbitrary executable paths or content parsers were introduced.
- Copy/drag still creates an immutable outgoing transfer snapshot, including the latest Note TXT or other original beside the Markdown context. These transport snapshots are never used for Open.

## Verification and recovery

The isolated regressions cover external edits, reopening, stable paths, provider restarts, migration, empty context, missing files, atomic file replacement, search refresh, repeat saves and the normal original-file AI workflow. A native test also resolves a native-created Note through the real Node library adapter, saves that same original, then verifies the updated file and native projection while retaining supplemental context. Final suites: 314 frontend tests and 135 native tests passed; one pre-existing clipboard-mutating test is explicitly ignored.

The pre-migration consistent database and code/build snapshot is `artifacts/canonical-note-file-20261017-before`. The read-only `scripts/note-file-preflight.mjs` checks for edits in TXT copies created by the superseded implementation before migration. It found no changed copies on this machine. Those previous files are not deleted.

`scripts/verify-canonical-note-migration.mjs` compares the consistent backup with the migrated collection by identity, metadata, exact Note file bytes and unchanged other-file fields. It does not equate the intentional asset-path/cache metadata migration with user-content loss.

The plugin resource is `ui://stashdock/shelf-v52.html`. Already-running AI hosts must reconnect StashDock to load the new writer. UI remains on the existing Arc card action and content-edit form; no internal reader, new modal or alternate Open flow exists.

## Installed acceptance

- Desktop SHA-256: `BF3FA972CA680272310FD7681BDCAD4ED56074B460E5045512D240CA7D0B4DA3`. The current `index-3kMERqvz.js` entry is embedded in the executable. The actual installed WebView loaded `http://tauri.localhost/` with the Vite server stopped.
- Read-only comparison with the consistent backup confirmed 48 reference identities, titles, tags, favorites and saved bodies retained. Both existing Notes now have real TXT files under `D:/StashDockData/assets`; other managed-file metadata was unchanged. No test references were added to this collection.
- Clicking the actual existing Note card opened Notepad with the exact managed asset filename, not a temporary exported filename.
- Installed plugin package and portable-server smoke checks passed with resource v52. Its isolated SDK test verified Note creation, stable original paths, an independent atomic file Save, latest body reads, preserved annotations and the original-file AI workflow.
- Actual bundled MCP UI in the development harness passed light/dark and 390/768px creation/readback phases. A separate Node fixture edited its originals directly on disk between phases; UI and search read the latest body while keeping annotations and IDs. This is a real bundle/SDK fixture, not automation of the ChatGPT application UI.
- Existing Arc controls and form styling remain unchanged. The Save result now publishes canonical persisted assets immediately, so new Note cards do not need a manual refresh to gain Open.
