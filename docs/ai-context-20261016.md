# AI context workflows: 2026-10-16

## Product decision

Context groups are the existing tags. No new pack/collection entity, group
database, group page or model service was introduced. Desktop and the AI panel
continue to manage and transfer the same references in one canonical library.

Recovery snapshot: `artifacts/ai-context-20261016-before`, including source,
preceding installed builds and a consistent 46-reference SQLite backup.

## Delivered tool/Skill contract

- `search_stashdock` retains keyword/newest-first matching and adds pagination
  (`offset`, `hasMore`, `nextOffset`). No semantic-ranking claim.
- `list_stashdock_tags` discovers existing tags/counts with filtering/pagination.
  Case variants are grouped without rewriting saved tags.
- `get_stashdock_items` reads up to 10 candidates, default 60,000 and maximum
  120,000 total body characters. It preserves selection order and intentional
  empty final edits, reports body/capture truncation, and does not return file
  paths or claim to understand binary assets. Read fewer candidates for more
  detail. Existing single-item read remains available.
- `save_stashdock_reference` is the model-visible creation write. Its strict
  schema permits a title, text, optional HTTP/HTTPS destination, tags, supplied/
  generated content marker and up to ten known source URLs. A note needs body
  text; a link may be saved without a fetched body. It does not fetch URLs,
  import arbitrary files, update existing references or delete anything.
- `apply_stashdock_tag_changes` is the second narrow model-visible write. It is
  only used after an exact request or an approved broad plan, applies add/remove
  patches, preserves other tags and skips stale per-reference revisions.
- Existing importing/title/content/global-tag/deletion tools remain app-only.
  These narrow writes do not remove the general management boundary.
- The existing use-stashdock Skill now covers task-based discovery/recommendation,
  tag-group use and explicitly requested saves. It does not invent project/chat
  access, silently apply saved rules, auto-save interesting material, send a
  message or masquerade a model read as a native composer attachment.

Recommendations are performed by the host model using these tools and its
authorized task context. The shipped workflow asks for useful reasons and task
applications, honest coverage/truncation, and no quota-filling. A separate
recommendation engine, vector index and automatically selected visual cards are
not part of this delivery.

## Write safety and persistence

Model tool calls use the trusted local MCP host/transport and host approval
policy. Neither a model-supplied approval flag nor readOnlyHint alone proves
authorization; no such approval field is accepted. User intent is guided by
the Skill/tool description, not falsely claimed as cryptographically verified
by the server. Retrieved text has no independent authority to request writes.

Direct specified saves need no redundant StashDock confirmation. Unclear or
newly synthesized proposals are previewed/agreed in the conversation unless
the user already requested saving that synthesis. Existing content edits and
destructive actions keep the visual App's own controls.

The library method owns validation and an immediate SQLite transaction. A
normalized payload fingerprint maps to its reference ID in existing app_meta,
so identical retries deduplicate across connections and server restarts. This
metadata is not another collection and follows the shared library relocation.
After a reference is explicitly deleted, the same content can be saved again.
Failed insert/index work rolls back the reference and retry mapping together.

Existing canonical URLs always return already_saved and preserve original
title/tags/content/final override/favorite. contentMatches explicitly signals
when the new body differs and was not stored. The Skill must explain that and
offer a separate note, not claim a new annotation was appended. Changed note
content is a new asset, never an implicit overwrite.

Original/generated provenance and known source URLs are retained in origin.
Default context exports include these in both JS (editor/MCP/browser) and Rust
(Desktop original-file/Markdown transfer). Final user-edited overrides remain
verbatim, without forced metadata. Existing file icons and window behavior are
unchanged. Newly saved data is visible through the same store; returning focus
or Refresh re-reads it in existing Desktop/MCP surfaces.

## Verification

- 305 frontend tests pass; TypeScript, extension asset parity and UTF-8 Skill
  validation pass. There is no separate lint script in the project.
- 130 native tests pass: 100 core, 2 independent startup, 24 preview helper and
  4 storage helper. The OS-clipboard-writing test remains intentionally ignored.
- Focused tests cover strict fields, URL schemes/credentials, existing tag/URL
  identity, invalid-input atomicity, rollback after indexing failure, restart
  deduplication, deletion/re-save, preservation of existing edits, tag counts,
  pagination, bounded Unicode reads and empty final overrides.
- Real MCP SDK tests exercise tag → search → read → save against isolated
  SQLite. The actual bundled server passes the same workflow and restart retry
  through `scripts/verify-ai-context-package.mjs`, with an independent library
  observer and provenance in prepared context. No real collection writes.
- Visual acceptance uses the actual generated MCP App and SDK proxy in an
  explicitly isolated mcp-test directory. No automation of the user's ChatGPT
  UI or collection. New context is checked in existing cards/content editor;
  screenshot/refresh assertions wait for final state instead of counting
  transient animated nodes as stored duplicates.

The rendered workflow passed in both themes and at 390/768/1024/1440, with zero
page errors. The existing editor displays the provenance; retry leaves exactly
one saved card. Arc's existing menu/dialog/textarea were retained unchanged.

## Installed preview

The current development plugin cache remains 0.4.27, now with resource
`ui://stashdock/shelf-v47.html`, new server tools, updated Skill and manifest
prompts. Server/UI/Skill/manifest byte parity was verified. Both source and
installed bundled servers passed the isolated package workflow/restart test;
the installed read-only smoke also passed against the actual collection.

Desktop rebuilt with tauri/custom-protocol and embedded index-DGD425h4.js.
Installed SHA-256:
`dd2f4ef872304abc7b76710456ab2df5c15a05cb190202a2a4c7fa05e3db2d5a`.
The actual packaged native panel opened successfully; Windows icon parity passed.
Window lifecycle/animation and file icon designs were not changed.

Real references remain 46, with canonical row SHA-256 unchanged:
`a07ff65b8ed740ecf8fbc95c7e308c31147fd4c25ce5625fd9ccf35720d8c8a0`.
All new-save acceptance data lives in isolated temporary libraries, never in
the user's collection. Existing conversations need plugin/tool/Skill refresh;
the current conversation may still advertise the previous tool set.

This tests tool/data/UI contracts, not a statistically evaluated recommendation
model or proof that every natural-language request triggers the Skill correctly.
Actual host tool/Skill refresh is needed for existing conversations. Native
composer-file receipt, private platform completeness and cross-host compatibility
are not newly certified by this feature.

Arc review: retained the existing Arc card/menu/dialog/field controls, shared
tokens, keyboard/focus behavior, circular icon-only controls and reduced motion.
No new layout/style or decorative AI UI was added.

Official boundary reference: [MCP tool annotations](https://developers.openai.com/plugins/build/mcp-server)
and [Skills](https://developers.openai.com/plugins/concepts/skills), checked
2026-10-16. MCP supplies controlled data/actions; Skills provide workflows;
annotations do not replace authorization or validation.
