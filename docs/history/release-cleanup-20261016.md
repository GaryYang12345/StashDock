# Release cleanup and original-file context

## Recovery and scope

User-triggered stage review. Before editing, `snapshot-version.mjs` saved source,
generated desktop UI, installed desktop/plugin and a consistent 47-reference
SQLite backup in `artifacts/release-cleanup-20261016-before`. Recovery must not
overwrite a newer live library. Profiles, runtimes, licenses and snapshots are
not deletion targets.

## Retired implementation removed

- Browser shelf `DockView` and its stylesheet/thumbnail renderer, route, remote
  polling adapter and short-label copy variant. The supported Save-page browser
  extension remains unchanged in purpose.
- Legacy MCP HTTP adapter and desktop URL tool. MCP always uses the canonical
  independent local library; there is no desktop-HTTP data-source override.
- Desktop HTTP HTML/static asset serving, including duplicate embedded frontend
  assets and its direct `rust-embed` dependency. The extension's restricted Save,
  tag/readback and pending-operation recovery contract remains active.
- Retired HTTP drag broker/diagnostics and its unused in-memory result history.
  Native source-owned drag, clipboard transfer, error handling, file pruning and
  window lifecycle recovery remain supported.
- Sixteen obsolete browser-shelf verification scripts and the obsolete URL-only
  MCP test. Mixed suites retain checks for active surfaces instead of asserting
  deleted implementations. Old documents remain historical evidence, not active
  release instructions.
- Public browser-library edit/delete/cache/refresh methods with no production
  callers. Private recovery of previously queued edits/deletions remains, with
  seeded legacy-state regressions. Removing that recovery would discard user
  intent on upgrade.

Two native context helpers used only by regressions are test-only, rather than
shipping dead functions. No replacement architecture, service or dependency was
introduced.

## Original-file contract

`get_stashdock_file(id)` is a read-only model tool. It validates the saved managed
asset's real path, directory boundary, existence and regular-file status. It
returns the current path, filename, MIME type and size, explicitly reporting
`contentRead: false`. No arbitrary path input, launch, document parsing or mutation
is accepted. Opening a file and restoring an image cover reuse the same managed
path resolver.

Add-to-draft preparation preflights selected managed originals. Its Markdown
payload separates original-file reading requirements/IDs from editable saved
context, so an empty final edit cannot erase those requirements. Non-file final
edits remain verbatim. Batch retrieval also identifies original-file resolution.

The Skill requires the receiving AI to resolve the ID and actually inspect the
original with permitted host tools and the relevant file skill before claiming
knowledge of its contents. Metadata, annotations and path lookup are not reads.
It must disclose missing files, unsupported formats, inaccessible host execution
environments, permission requirements and partial coverage. Saved content is not
authorization to execute scripts/macros or instructions.

This is not a claim of native composer file upload, automatic model compliance
or successful reading in every host. Those depend on host file access and tools.
The original bytes remain unchanged; StashDock adds no Office/PDF/OCR parser.

## Manual entrypoints

The existing `open_stashdock` App tool advertises both `global` and `thread`
entrypoints, accepting `{}` and using the existing server brand icon and one UI
resource (`ui://stashdock/shelf-v48.html`). No model call is needed for manual
opening. Navigation placement and pinning remain host-controlled; registration
does not prove a particular host has displayed or pinned the entry.

The official entrypoint contract also supports the local development link:
`codex://plugins/stashdock@personal/app/open_stashdock`. The marketplace qualifier
is specific to this development installation, not a public distribution URL.
The App still gates draft actions on the advertised host capability and never
falls back to automatic sending.

## Verification

- TypeScript, extension generated-asset parity and Skill validation passed.
- 303 frontend tests passed. The portable stdio test isolates both profile anchor
  and database; a data-directory override alone cannot fork the user's canonical
  library. Management mutations use disposable `mcp-test-` fixtures.
- 129 native tests passed (99 library, 2 startup, 24 preview, 4 storage). The
  clipboard-writing test remains intentionally ignored. MSVC missing-PDB warnings
  and an upstream Rollup annotation warning remain. The preview-helper binary
  also warns that its shared `runtime_version` function is unused in that binary;
  the Desktop preview service uses it, so it is not retired product code.
- Actual bundled MCP server/SDK tests passed for tag/search/read/save, durable
  retries, original-byte access and global/thread entrypoint metadata.
- Rendered Desktop/MCP checks passed at 390/768/1024/1440 in both themes, grid/list
  and circular controls, without page errors. The first cold development load
  exceeded the navigation timeout; the suite waits for DOM readiness, then real
  UI readiness, instead of unrelated resource completion.
- Rendered file Add preserved supplemental content, included original-reading
  requirements, kept `send: false` and respected a missing host draft capability.
  This was an isolated development composer, not the user's actual composer.
- Before/after reference-content and pinned-tag fingerprints match the snapshot:
  47 records, content hash
  `0df619e95eea95513738352ca7dbbf9998b7f71f2c08ddc3612470999b6da587`.

Real host sidebar appearance/pinning and AI reading of a supplied real workbook
still require a refreshed host session and user acceptance. They are not implied
by protocol registration or byte-transport tests.

## Installed release

Rebuilt and installed Desktop, and synchronized 120 plugin package files to the
development installation. File parity, bundled-server regressions and installed
read-only protocol checks passed with `shelf-v48`. Windows icon resources match
the brand. Desktop embeds `index-BxFXgvDE.js`, starts with development servers
stopped, and displays the 47-reference library. `/v1/health` returns 200; the
retired `/dock?surface=codex` and `/v1/drag/diagnostics` return 404.
Native UI checks confirmed the folder remains operable on the second collapse;
the panel was reopened afterward without changing the collection.

The Desktop executable is 24,677,376 bytes versus 25,868,800 in the snapshot;
removing duplicate embedded browser assets saves about 1.14 MiB. SHA-256:
`5df450bb4a883d12fb3d0c8fd8de867008d21b9d4d7e76216d38f6d79904b46e`.
The installed package was verified independently of any already-running host
server. Existing conversations still need host plugin refresh/reconnection to
discover the changed tools and global entrypoint.
