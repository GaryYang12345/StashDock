# Desktop settings, 2026-10-15

## Scope

Desktop 0.2.2 only. The wide dashboard has Settings at the bottom of its navigation; narrow windows expose the gear in the title bar. Settings replaces the content area while the shelf stays mounted, preserving query, selection, filters and scroll. Codex and the Save sidebar do not gain settings in this release.

Three groups, composed from installed Arc Button, menu, Alert, Skeleton and ScrollArea components:

- General: system/English/Simplified Chinese, system/light/dark appearance, launch at login, and three shortcut choices plus None. Changes take effect immediately. No new close/window-mode policies.
- Storage: actual managed-library usage, reference count, the current folder, Open folder and Change location. No backup/restore or cache-management feature.
- About: the actual desktop package version and a user-initiated update check. GitHub appears only when its real repository has been configured.

Arc's registry was unreachable when the feature was implemented. The existing Arc menu is reused for small preference choices rather than inventing an imitation switch/radio control or reconstructing a Pro settings page. Settings is an in-panel page, not an additional native window.

## Ownership

- `src/features/settings/preferences.tsx`: desktop-only lifecycle, native events and appearance preferences. SQLite is authoritative; localStorage is only a best-effort first-paint appearance cache.
- `locale.tsx` and `messages.mjs`: scoped interface translations. Hosts without the desktop provider remain English. Saved titles, content, URLs, original filenames and user tag names are not translated. An early event from the other native window must not invalidate the only initial settings read.
- `SettingsView.tsx`: product layout and explicit pending/error states; no OS or migration implementation in JSX. Storage is read only when this page opens, not by an always-running disk scanner.
- `src-tauri/src/settings.rs`: typed/validated preferences in `app_meta.desktop_preferences_v1`, registered shortcuts, Windows Run entry, storage details and updates. Startup is not silently enabled on upgrade. Windows system UI language is shared with the tray. Close/minimize and process independence remain under the existing window lifecycle authority.
- `src-tauri/product-links.json`: release-owned `githubRepository`, currently null. Set it to `owner/repository` when the real public repository exists. Never replace it with a guessed public URL. Update checks are bounded, read-only GitHub release lookups; they do not download/install anything. No updater polling or telemetry.

## Storage migration

The chosen destination must already exist, be empty, and be outside the source library. The confirmation explains the move/restart and reopening the Codex panel. An active move prevents normal window controls and shortcuts from hiding the operation.

1. Reserve a SQLite IMMEDIATE write transaction on the source. A separate read connection takes an online backup including WAL data, so the copied database is a consistent snapshot.
2. Copy managed originals and verify SHA-256, without reading document contents for AI. Reject linked/unsupported assets. Rebase only managed `asset_path` values in the copied database; preserve original-path provenance, user content and tags. Verify the copied SQLite database before switching.
3. Commit `app_meta.library_location_v1` and write-retirement triggers to the source database atomically. Do not delete the old library. Failures before this commit leave the original active; an incomplete destination is retained rather than risk deleting user files. A retry needs another empty folder.
4. Restart the desktop. New native/plugin sessions follow the redirect, even when they inherited the old `STASHDOCK_DATA_DIR`. A missing destination fails visibly rather than creating an empty library.

The MCP local-library adapter follows redirects on later calls, including previously captured function references. Old preview workers stop claiming/writing jobs after relocation. The desktop browser bridge resolves location per request. Already-running pre-upgrade plugins must reopen; source triggers reject their stale writes rather than fork the collection. This release updates the plugin's storage compatibility, not its settings UI.

Retained old folders are recovery copies, not independent writable libraries. Do not delete them automatically. Manual rollback after an actual move requires deliberately choosing the old data, removing its location key and `moved_*` retirement triggers with all clients stopped; changes made after the move are not present there. Merely running an old executable is not a complete data rollback.

## Verification and limits

- Frontend type checking and 269 Node regressions, including scoped locale/identity tests, live/new MCP redirect tests and a rendered React lifecycle test proving cached dark startup does not flash light and early cross-window preference events cannot strand initial loading.
- Native regression suite includes real SQLite migration, unchanged originals, rebased paths, stale-write rejection and nonempty/nested-target refusal.
- `verify-desktop-settings.js`: isolated real Chromium UI with mocked native IPC. Covers English/Chinese, light/dark, 390/768/1024/1440 widths, search/selection retention, shortcut conflict without replacing the old value, unconfigured updates and move failure/success gating.
- `verify-settings-keyboard.js`: isolated keyboard/Escape/focus, OS theme switching, reduced motion, startup UI, Chinese Link/Note/File state identities, a blue accent and short-window reachability.
- Production desktop embeds the built frontend with `tauri/custom-protocol`; no development server is required. Actual installed-window acceptance is recorded below when complete.

The public repository/update feed is not configured, so real remote release discovery is not live-tested. Launch-at-login has a real Windows registry implementation, but verification does not enable startup on the user's machine. The actual user library is not relocated for testing; migration uses isolated databases.

Recovery artifacts before deployment:

- `artifacts/library-before-settings-20261015.sqlite3`
- `artifacts/stashdock-before-settings-20261015.exe`

No collection data is replaced by these artifacts or by installation.

## Installed acceptance

- Final installed executable SHA-256: `61E9856D1DC9E2D4150DA11892BD3CF55F6F1FFD11A24BEC7CC2EB9657196D6C` (25,529,856 bytes). The final `index-DkHKDkNi.js` asset is present in the executable. The owned Vite server was stopped before native acceptance. The final replacement adds only the verified startup-appearance guard after the full native feature checks.
- Actual packaged Windows UI opened the collection and the bottom-left Settings entry. Settings displayed 46 references, the real `D:\StashDockData` location, 7.2 MB managed-library usage, desktop version 0.2.2 and startup Off.
- Actual native menus changed the full shell to dark and English and back to system language/system appearance. Preferences were confirmed durable in SQLite. Startup was not enabled, no files/references were added and no storage move was performed against real data.
- The real update button produced the honest unconfigured-public-release message. The existing global shortcut still switches to the topmost folder and back; the panel retains its Settings page.
- The installed MCP server bundle, location resolver and shared HTML were checked against their build outputs. A running pre-upgrade MCP process is not silently replaced; reopening its connection loads the new compatibility logic.
- Collection fingerprint before/after native acceptance: 46 items, content SHA-256 `48d47b8dc7d84e7d0fc5feb0039b54e0db4a3f99c4b3dc405de94f541a7a3592`, pins SHA-256 `631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864`.

Arc review completed: semantic tokens and type scale; sentence-case copy; no new hand-drawn icons, decorative colors or custom focus rings; aligned settings column; grouped rows; explicit loading/error/disabled states; long-path wrapping; stable mounted shelf; menu keyboard/Escape/focus return; reduced motion; light/dark and neutral/blue accents; 390/768/1024/1440 widths plus 390x420. The only component-selection fallback is the documented installed-menu choice above. Automated source sweeps and TypeScript pass.
