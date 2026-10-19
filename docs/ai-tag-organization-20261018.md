# AI tag organization — 2026-10-18

## Product behavior

StashDock now lets a host AI inspect a user-selected scope, propose a clearer tag organization and apply the reviewed plan. Existing tags remain the only context-group model; no collection, taxonomy database or background organizer was added.

- Compact paginated search is used before full context reads.
- Broad or ambiguous organization must be previewed with scope, changes and affected counts before any write.
- A direct, exact request such as “add Research to these references” authorizes only that stated change.
- Existing tags are preferred. New tags should form reusable groups rather than one-off labels or near-synonyms.

## Write boundary

`apply_stashdock_tag_changes` is a dedicated model-visible mutation. It accepts at most 30 unique references per call and only:

- a reference ID;
- the latest `tagRevision` returned by search/read;
- tags to add;
- tags to remove.

The server preserves every unmentioned tag. Missing or changed references are skipped and reported as conflicts. The tool cannot edit titles, content or covers, rename/remove a tag globally, delete references, accept arbitrary paths, or accept a caller-provided approval flag. Existing visual-App management tools remain app-only.

The revision hashes only the reference ID and current tag list. Unrelated body/title changes do not block a tag-only patch, while every meaningful tag change does. Reapplying an uncertain request cannot duplicate a tag; an old revision becomes a visible conflict.

## Skill workflow

The packaged `use-stashdock` Skill requires the model to:

1. list existing tags;
2. page through the complete requested scope;
3. read full context only for ambiguous candidates;
4. present a plan for broad organization and wait for approval;
5. apply exact add/remove operations with current revisions;
6. report updated, unchanged and conflicted references without silently retrying stale work.

## Verification

- Complete frontend/static suite: 337 passed, 0 failed.
- Focused AI-context/local-library suite: 20 passed, 0 failed.
- Source and installed MCP packages both passed isolated SDK verification, including approved tag organization, restart idempotency, shared-library visibility and `realLibraryWrites: 0`.
- Production MCP App/server package built successfully.
- Installed manifest, server bundle, Skill and App resource match the source package byte-for-byte.
- Browser Arc asset parity passed; browser behavior was not changed.
- The live 48-reference library retained canonical SHA-256 `ccba2fec723184b550d5d708ae83b790fc8b6cce36c08642bc3e8398cd89c093`.

An existing conversation may retain its old MCP tool list and Skill snapshot. Start a new conversation before acceptance testing the new workflow.
