# Save-page duplicate confirmation and compact transport

Version 0.4.13 shares one implementation across Chrome, Edge and Firefox.

- Remove the browser shelf snapshot and HTTP whole-library listing. No new Save
  writes a second copy of the collection to browser storage. Retain only tag
  names plus unfinished operations from old releases; those have single-target
  recovery without whole-library readback.
- On Save, query the current canonical URL. A conflict returns only ID, title
  and revision, with no body, cover, other references or file paths. Keep existing,
  Close and Escape do not write. Replace updates title, captured content, tags
  and cover, retaining ID, creation time, favorite and separate AI context.
- Recheck identity/revision inside an immediate transaction. Another window's
  create/edit triggers a new confirmation; deletion cannot resurrect a record.
  Same-page observer refreshes pause during confirmation; navigation dismisses it.
- Mutation timeouts are not automatically replayed or sent to another provider.
  An explicit unchanged retry checks the shared digest/receipt and can acknowledge
  an already committed operation without resending the capture or replacing again.
  At most 256 small receipts are retained, with no captured content in them.
- Normal Save adds one loopback metadata query, not an external network request.
  Declining a duplicate uploads no body/image. URL lookup uses an index for current
  canonical rows, with an ID/URL-only local scan for legacy URL spellings. URL
  normalization aligns the two providers' empty queries and query encoding.

Verification: 310 frontend regressions and 134 native tests passed (one unrelated
clipboard test intentionally ignored). Rendered isolated sidebar checks cover
light/dark at 320, 390, 768, 1024 and 1440 px, cancellation/Escape, replacement,
error/retry and navigation invalidation, with zero page errors. Screenshots checked.
Firefox validation remains zero errors and four bundled-library warnings.
These are isolated tests, not claims of a new real-browser installation or writes
to the user's library. Recovery snapshot is
`artifacts/browser-save-confirm-20261016-before`.

Installed Desktop SHA256:
`9EED6693349BBCBB43F1AA13F3E21D03A690240223441C43CECE2C028C11E64F`.
The installed native capture lookup responds with a compact result; the packaged
desktop window loads with the development server stopped. Deployment preserved
the current 48-reference content and pinned-tag fingerprints. An already running
old MCP bridge still returns 404 for the new route until its host reconnects;
the extension's read-only provider discovery selects the updated Desktop instead.
