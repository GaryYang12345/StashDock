# AI context delivery, 18 October 2026

## Contract

Default context retains title, URL, meaningful source (unless it duplicates the
URL host), available author/publication date, tags and content provenance/source
URLs. It no longer exports browser/import provenance, bookmark folders, saved
date or absolute managed paths. Existing metadata is not deleted from storage.
Import/save time is not called publication/capture time; no missing date is
invented. All saved tags remain because the app cannot reliably infer which
ones matter to a future task.

Bodies are labelled Saved content, Saved page content, Selected text, Summary,
Note text or Supplemental context using known saved metadata, not AI inference.
Known selection-only capture, incomplete source capture, link-only references
and the existing 20,000-code-point export limit are explicit. Truncation examines
at most 20,001 code points and never cuts a Unicode character. It does not
summarize, rewrite or fetch source content. Captured material is not promoted to
instructions or treated as verified facts.

Explicit final context overrides retain the previous exact contract, including
whitespace, long content and intentional empty values. They are not silently
regenerated or scrubbed, including any path a user retained in their own final
text. File-reading/delivery metadata stays separate from the editable text.

## Files and hosts

Desktop clipboard and OLE drag still deliver one flat group of original bytes
plus Markdown. Original bytes and user annotations remain unchanged. A file's
default section uses its actual collision-safe outgoing name. The mapping is
applied only to the immutable transfer snapshot; shared originals are copied
once but all selected references retain their mapping. A Note's derived text
projection is omitted only on this actual original-file delivery path. Its TXT
and separately edited final context are still delivered.

The MCP context message explicitly says that original files are available through
`get_stashdock_file`, not attached by the message itself. It retains ID, title,
basename and MIME for each original plus the existing read-before-claim workflow.
Readable Note text remains available. Model batch reads distinguish Note
projections, supplemental file annotations, excerpts and page/selected content,
and expose available publication/capture-method metadata. A returned path is
still not a content read.

## Ownership and acceptance

`context-format.mjs` owns JS formatting/body identity and is reused by the MCP
batch reader. Native formatting is isolated in `library/context.rs`; both execute
`tests/fixtures/context-contract.json`. Native transfer owns actual attachment
names and formats from one selected-item snapshot only after file copying.
Failures still remove only the fresh outgoing group; there is no fallback to
path text or a different context payload.

Recovery snapshot: `artifacts/context-delivery-20261018-before`. MCP resource
identity advances to `ui://stashdock/shelf-v58.html`. Earlier verification reports
describe historical formats, not the new default envelope.

Source acceptance: TypeScript and 334 frontend tests pass. Native suites pass
140 tests, with the existing clipboard-writing test intentionally ignored. The
shared cases cover default metadata, body identity, complete/partial/link-only
material, empty overrides and native Note de-duplication. Additional tests cover
Unicode limits, actual collision-safe filenames, immutable original bytes,
unchanged saved filename metadata and separate MCP original-reading instructions.
These tests do not assert that an actual AI host has read an original file.

The packaged MCP UI was rendered through the actual SDK bridge in an isolated
host harness. Original-file Add preserves annotations and read requirements,
keeps send:false, leaves the draft unchanged and disables unavailable draft
capabilities. The AI-created Note appears in the same shelf and its content
editor displays File, generation provenance, sources/tags and the Note text
heading in both themes/four widths. Installed-package SDK acceptance verifies
tag/search/read/save, exact original bytes and restart idempotency without
writing to the real library. Actual ChatGPT composer upload/read was not tested.

Installed MCP server SHA-256:
`148b134fe81ae48aafe89ad231f5de389e52f8f99ca172cfca8bf377860e21dd`.
Installed shelf HTML SHA-256:
`5affecc24b758dd3ae3fd2ed42c5aae896b704b0652f9e6beee8c38b93bf6ead`.

Installed Desktop SHA-256:
`7F73A016EF3A333E1DE0C523CB38501E2ECF83FBF5D9D458E2741AFCA671AFAB`
(embedded entry `index-CCIW6O7H.js`). With test services stopped, the actual
packaged `http://tauri.localhost/` window opened a non-overridden public webpage's
Edit content dialog and displayed title, URL and Saved page content without
duplicate source/import bookkeeping. The dialog was dismissed without saving.
The 48-reference digest remains unchanged. Native clipboard/OLE export tests
exercise the outgoing file group, not actual AI composer receipt or file parsing.
Generated Chrome/Edge/Firefox packages remain in canonical asset parity.
