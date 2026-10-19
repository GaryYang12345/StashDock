# Preview loading and selection, 0.4.9

## Changes

- Desktop and MCP cards reuse `PreviewArtwork` and the installed Arc Skeleton. Missing screenshots show `Loading preview…` only when a live desktop worker reports queued or working. Failed/unavailable work returns to the normal kind placeholder. Existing images, notes and files do not falsely enter loading.
- `previewStatus` is read-time metadata, not a saved field in a reference. A 90-second worker lease prevents an independent MCP library from inventing ongoing screenshot work when desktop is closed. Worker claims and completion invalidate desktop reads; MCP refreshes loaded pages while preview work is pending, guarding stale responses and preserving selection/pagination.
- The legacy desktop HTTP visual endpoint also includes this additive status field. The compact one-line skeleton and loading label fit the default two-column MCP card artwork.
- Both deletion dialogs retain the reference name and remove the original-site/bookmark reassurance paragraph.
- Both selected-reference bars share an Arc ghost `Select all` control. Desktop selects its filtered collection; the MCP read-only selection tool returns all matching IDs, including references beyond the first loaded page, without exposing captured bodies.
- MCP attachment preparation retains its 30-reference request bound. Larger selections add bounded snapshots to the draft without replacing existing input; acknowledged batches remain tracked on a partial failure.
- Narrow MCP selection bars wrap, keep clear/action on opposite sides and reserve enough scrolling space for the last item.

## Verification

- TypeScript check passed.
- Frontend suite: 173 passed. Native suite: 59 passed.
- `tests/preview-selection.test.mjs` verifies real task-state metadata, independent-library fallback, no persisted UI state, filtered selection across 65 records and body-free selection responses.
- Native test verifies queued, working, failed and unavailable states, preservation of captured content, and no loading without a live worker.
- `scripts/verify-preview-selection.js` passed against isolated desktop/MCP fixtures: animated loading, screenshot replacement, failure fallback, reduced motion, Select all across 36 records, two 30+6 draft attachments, original draft preservation, deletion copy and light/neutral plus dark/blue layouts at 320, 390, 768, 1024 and 1440 pixels. The loading label fits inside the default 390px two-column artwork. Trial clicks confirm the final pagination control is not covered by the selection bar.
- UI test draft is explicitly a fixture, not Codex's real composer. Native OS mouse interaction was not automated.
- Windows release and NSIS installer built; native brand icon verified at nine sizes.

## Arc review

- [x] Existing Skeleton/Button used with documented props; no Arc internals rebuilt or restyled.
- [x] Sentence case, concise English state copy, semantic colors/type/spacing, no ornamental explanation.
- [x] Loading dimensions remain reserved; real failure/success/disabled states are represented.
- [x] Reduced motion, accessible status/busy states, keyboard-operable controls and shared tooltip adapter.
- [x] Two themes/accents and all target widths checked without horizontal overflow.
- [x] Existing card/menu/footer consistency retained; selected footer and last-item scrolling checked.
- [x] Type check and automated consistency sweeps passed. Project has no separate lint script.

## Deployment

- Official `codex plugin add stashdock@personal --json` installed 0.4.9. UI resource: `ui://stashdock/shelf-v11.html`.
- Reinstalling the same cache version was blocked by a Windows cache-directory backup lock. The final generated HTML was therefore copied to that exact installed plugin after backing up the earlier HTML. Source/installed UI SHA256 match: `A4D86F5693E889C44A933AC4BBE710CB1E35059DD5778EB787C26492BA6CB5C8`. Source/installed server hashes also match. Fresh installed-server smoke verification passed, including the new selection tool.
- The first compound desktop restart command was rejected. After renewed explicit user confirmation, the verified old StashDock PID 40052 was stopped; no other application's processes were ended.
- Final installed/release executable SHA256: `49682E1CBFC8B6E9454CCF9210CDE3783B94F3C32960142A0B653B9DB2CDCA51`. Restarted root application PID 43156; health endpoint reports ok. Final compact-loader/HTTP contract patch replaced intermediate PID 37272, also verified as the exact root StashDock executable.
- Final NSIS SHA256: `C1D55F7C5C75457E5276D1E2C52A102B19A7C67AC3C10A021027290D44335EC8`.
- Recoverable executable: `artifacts/stashdock-before-preview-selection-20261011.exe`. Consistent SQLite backup: `artifacts/library-before-preview-selection-20261011.sqlite3`.
- Before/after content-only fingerprint matches for all 32 references: `c56f67d62f82678b7df116ae40ab484f08efba602ff308e6db868234e63ab303`. Pinned tags match: `631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864`. Preview/favicon enrichment is deliberately excluded from this protected-content comparison.
- Own browser session and development servers closed. Existing Codex conversations keep their original MCP connection; open a new conversation to use the updated plugin tools/resource.
