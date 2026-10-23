# Integration settings — 2026-10-15

## Product contract

One product, one authoritative per-user local library, independent entry points.
Desktop, Codex and future AI plugins use the same local collection. A browser
extension captures pages through an available local provider; it does not own a
second database. Browser capture and using references in an AI conversation are
different tasks and have separate settings sections.

Desktop settings shows Browser extensions and AI plugins. Codex settings shows
Browser extensions and Desktop app, without advertising competing AI hosts.
Browser setup shows Desktop app and AI plugins. Shared Arc rows, original marks,
spacing, guides, focus return and status presentation are reused across hosts.

## Release state

- Desktop 0.2.4, browser extension 0.4.9; Codex packaged UI resource v39.
- Chrome, desktop and Codex have active integration adapters.
- Edge, Firefox, Safari and Claude are fully styled, explicit Coming soon rows.
  Bookmark import support is not a claim of extension support.
- Public installation URLs are intentionally unset in
  `src-tauri/product-links.json`. Guides explain setup without fake store links.
  Populate verified release destinations when publishing.
- Detection uses only StashDock's own registrations: a present registered app/
  plugin path, or a successful extension handshake within 24 hours. It is labelled
  Detected, not a guarantee that another application is currently enabled/running.
  No browser profile/history/cookie scanning or new permissions are involved.

## Ownership and data

`library-root-v1.json` in the stable per-user application-data directory records
the first authoritative library anchor. Native and Node implementations share
the schema. First registration is an atomic create-if-absent operation; a later
environment override cannot create a second collection. Initialized missing data
fails closed. Existing library relocation redirects remain the move authority;
the registration itself retains its anchor. Internal explicit test directories
stay isolated from production registration.

Presence registrations live in the authoritative library's `app_meta` table.
Both local bridges provide bounded, extension-origin-validated `/v1/setup`
handshakes. Browser requests expose non-sensitive status only. Initial extension
installation opens setup only when no provider is available; updates do not
continually open welcome tabs. The side panel also provides a Settings entry and
periodic visible-only checks. Returning from setup preserves the edited draft.

Save requires a confirmed provider and a durable library commit. An offline
outbox is recoverable transport state, never another collection or a Saved
success. Ambiguous Save operations are not automatically replayed by the UI.

Native cold start mounts library/settings consumers only after both native
library and window lifecycle state are registered. This prevents early IPC from
stranding settings and pinned-tag reads. Readiness has a bounded timeout, visible
retry and unmount protection. It does not affect folder/panel handoff or introduce
motion, renderer completion handshakes or repeated shelf remounts.

## Verification and delivery

Focused tests cover first-registration races/overrides, missing registered data,
registration validation, bounded provider discovery, legacy provider fallback,
real local HTTP handshake/origin rejection, install versus update behavior and
cold-start gating/retry/unmount. The full frontend and native suites remain the
regression baseline. Rendered checks cover both themes, narrow widths, loaded
brand images, guide Escape/focus behavior, offline setup and preserved drafts.
The built Codex App is exercised through its real SDK in an isolated host harness;
this is not a claim of automating the user's actual Codex window.

Before deployment, a consistent SQLite snapshot and previous installed desktop
binary were preserved in `artifacts/*before-integrations-20261015*`. Reference
content and pins are checked before/after deployment. Restart only the exact
StashDock desktop executable; never terminate Codex, Chrome or their process trees.
Desktop packaging must embed the frontend with `tauri/custom-protocol`, and actual
native acceptance runs with the development server stopped.

Browser unpacked files require one Reload in `chrome://extensions`. Codex's
running MCP server retains its old tool registry until the plugin is reconnected;
reopening an old App tab alone cannot replace that registry.

Brand notices: existing browser assets plus alrra/browser-logos Safari, and
LobeHub MIT marks for Codex/Claude, bundled with applicable notices. Marks identify
platforms only and do not imply endorsement.

### Final acceptance for this build

- TypeScript and extension asset parity passed; frontend 278/278 passed.
- Native 121 passed, zero failed; one pre-existing interactive clipboard test is
  explicitly ignored.
- Installed desktop SHA-256:
  `B62BB2F10D59BC607FACF4C00F2606729DE33773DC0F998F28F03AC9B1341B97`.
  The binary embeds `index-BKXMDBdY.js`. With the development server stopped,
  cold start loaded the 46-reference collection, the Codex pin, Settings, all six
  integration rows and the Chrome guide; Escape dismissed the guide.
- The final self-contained MCP HTML passed its SDK host harness again at five
  widths (320–1440), with browser/desktop sections, loaded images and guide
  dismissal. Installed HTML, stdio bundle and preview helper hashes match source
  build artifacts. Actual Codex host reconnection is left to the user.
- Reference metadata/content signature stayed
  `a07ff65b8ed740ecf8fbc95c7e308c31147fd4c25ce5625fd9ccf35720d8c8a0`;
  fixed tags and desktop preferences match the pre-deployment snapshot.
