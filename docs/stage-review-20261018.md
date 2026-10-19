# Stage review — 2026-10-18

This review is the release-preflight checkpoint before Claude plugin development. It covers the Desktop app, ChatGPT MCP App, Chrome/Edge/Firefox Save extensions, shared library contract, UI consistency, packaging, security, performance and user-data invariants.

## Recovery and data invariant

- Recovery snapshot: `D:/StashDock/artifacts/phase-check-20261018-before-claude`
- Snapshot contents: 869 source/build files and a consistent 48-reference library copy.
- Live library baseline SHA-256: `ccba2fec723184b550d5d708ae83b790fc8b6cce36c08642bc3e8398cd89c093`
- Verification and benchmark work uses synthetic/disposable repositories. The final package verifier reported `realLibraryWrites: 0`.

## Corrections made

- Removed an accidental root-level JavaScript error-dump file.
- Replaced stale browser-save and connection messages with current product language, including Chinese localization, and removed unused copy.
- Updated the README from the retired favorite-import positioning to the current AI-context reference workflow.
- Hardened both native and Node local bridges: bootstrap setup now validates an exact enabled extension identity and stores its exact origin; data and recovery routes reject unregistered origins. The browser client repairs registration once after a `403` and retries once without a loop.
- Added regression coverage for missing registration, foreign origins, disabled extensions and one-time client repair.
- Applied Rust formatting and made source-contract tests whitespace-independent instead of depending on formatter output.
- Updated this architecture document to remove the obsolete whole-library HTTP-transfer claim and record the active browser trust boundary.

No layout, geometry or visual token was changed in this checkpoint. Product copy remains localized, and the existing Arc component, hover, accessibility and surface-consistency tests cover the affected UI.

## Verification

- Frontend/static contract suite: 336 passed, 0 failed.
- Rust: 142 passed, 1 intentionally ignored OS clipboard integration test, 0 failed.
- Production web build: passed.
- Desktop check: passed without source warnings.
- MCP package build and self-contained resource validation: passed.
- Chrome, Edge and Firefox extension packages: generated from the same canonical source; Arc assets match.
- Production dependency audit: 0 vulnerabilities.
- Context-package contract: tag/search/read/save, durable retry, shared-library visibility, provenance, original-file bytes, canonical Note originals and manual entry points all passed.
- Rust formatting check: passed.

## Performance snapshot

Isolated stage benchmark:

- Median operation: 62.43 ms
- Maximum operation: 90.76 ms
- 100 idle checks: 23.55 ms
- Lease commits: 6
- Maximum RSS: 87.5 MiB
- Writes to the real library: 0

This is within the existing stage baseline and does not indicate a new import-dialog, polling, thread or memory regression.

## Remaining release work

- Before public browser-store distribution, bind Chrome/Edge to their final signed store IDs and Firefox to its signed identity. Development presence detection plus exact-origin registration is not cryptographic store identity.
- Lists are not virtualized. Validate with a deliberately large synthetic library before deciding whether pagination/virtualization is worth its drag, selection and layout complexity.
- Mixed-DPI multi-monitor behavior, long native drag sessions, and macOS/Linux native behavior still need hardware/soak validation.
- MSVC may emit missing third-party static-library PDB warnings, and Rollup may report upstream Zod annotation warnings. They do not fail or alter the production packages.

## Decision

The current product is clean and stable enough to begin Claude plugin development. The browser signing item is a public-distribution gate, not a blocker for the next plugin, provided Claude reuses the shared library/context contracts instead of introducing a second data path.
