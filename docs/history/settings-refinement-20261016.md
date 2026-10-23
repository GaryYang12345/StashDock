# Settings refinement — 2026-10-16

Supersedes the installation-status and read-only plugin-storage UI notes in
`integration-settings-20261015.md`. Historical acceptance for that release remains
unchanged.

## Shipped behavior

- Desktop 0.2.5; Chrome extension 0.4.10; ChatGPT App resource v40.
- Settings uses StashDock Desktop and ChatGPT, with original brand assets in both
  About rows. Internal Codex IDs/preferences/installation records remain compatible.
- Desktop and plugin compose one `StorageSection`: usage, path, Open folder,
  Change location, confirmation and recovery. Optional sharing explanation uses
  the installed Arc Popover behind a labelled question-mark button. Essential
  migration consequences remain visible in the confirmation.
- Guides are one task-specific sentence; repeated pairing/database reassurances
  were removed. Product copy and necessity rules are recorded in AGENTS.md.
- Setup checks all setup-capable local providers before accepting a legacy health
  fallback. A legacy service cannot suppress another provider's registration.
  Discovery is single-flight, runs again on toolbar activation and existing
  visible-sidebar checks; Settings also refreshes on activation. No new permanent
  service or browser permission is added.
- Confirmed setup is labelled Configured, not Installed/Connected. It does not
  expire after 24 hours. No negative installation claim or historical connection
  taxonomy is shown when no registration exists. This is not an OS-level audit of
  extension enablement or uninstallation.

## Storage implementation

The App-only folder picker returns an opaque, expiring token in metadata. Move
accepts that token, not an arbitrary source/destination from the UI. Operations
are serialized; cancellation cannot authorize a move. Paths are excluded from
model-facing results. Helper output/time are bounded and process ownership is
cleaned up when the server closes. Mutations are never automatically replayed.

`stashdock-storage` is an on-demand native adapter, not a daemon. It uses rfd's
native folder dialog and the same Rust `library_location::relocate` implementation
as Desktop: online SQLite snapshot, original-asset verification, atomic redirect,
and stale-writer rejection. The preview helper remains separate from library
management. Node clients follow the redirect; an idle Desktop checks on activation
and uses its existing restart path when another entry point moved the library.
Windows verbatim/UNC prefixes are normalized for comparison and display without
changing the actual storage location.

## Acceptance

- TypeScript, generated extension asset parity and Arc semantic CSS sweeps passed.
- Frontend: 284 passed. Native: 126 passed, zero failed, one pre-existing ignored
  interactive clipboard test.
- Rendered Desktop: language/theme, shortcut conflict, selection/search retention,
  migration failure/success, click-only help, Escape/focus return, original brand
  images, light/dark and 390/768/1024/1440 layouts.
- Built plugin with its real App SDK in an isolated host harness: preference
  persistence, errors/retry, host-theme override, localized shelf, retained
  search/selection and 320–1440 layouts.
- Actual native picker through the App harness, confirmation, real migration and
  refreshed path passed using temporary fixture libraries only. A separate actual
  helper test verified unchanged PDF bytes/title/context/tags, two live Node
  clients following the destination and stale writes rejected at the old DB.
- Installed Desktop cold-started with Vite stopped, loaded 46 references/pins and
  Settings. Installed executable SHA-256:
  `323EC73D4610EEACE7C160386267A4BF19753823A27BDB23363EDF3386EEDDDC`;
  embedded frontend `index-EMLEqtzo.js`.
- Installed plugin HTML/server/storage helper hashes match the final build.
  ChatGPT's actual host UI was not automated; reconnecting the plugin is needed
  to refresh its running tool registry. Chrome needs one extension reload.
- User reference signature stayed
  `a07ff65b8ed740ecf8fbc95c7e308c31147fd4c25ce5625fd9ccf35720d8c8a0`.
  All 46 references, pinned tags and desktop preferences are unchanged. Recovery
  snapshots are `artifacts/*before-settings-refinement-20261015*`.

Release installation URLs remain intentionally unconfigured until publishing.
