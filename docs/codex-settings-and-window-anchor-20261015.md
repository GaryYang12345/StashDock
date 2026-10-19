# Codex settings and native return anchor

## Scope

Desktop 0.2.3. Codex keeps its installed plugin package version 0.4.27 and uses a new shelf resource URI v38 to invalidate the previous embedded page.

- Native handoff stores a transient pair: the original folder geometry and actual settled panel position after reveal. An unchanged panel returns to the original folder anchor; a moved panel uses its current centre. Work-area clamping still protects disconnected monitors and DPI changes. No animation or extra window was added.
- Tags heading is outside the single Arc ScrollArea. Its content stays mounted when collapsed, preserving its own scroll position. Collections and Settings are outside the scrolling list.
- Desktop and Codex compose SettingsFrame, SettingsRow, SettingsChoice and AppearanceFields. No copied settings markup or new UI library.

## Host capabilities

| Setting | Desktop | Codex |
| --- | --- | --- |
| Language | System, English, Chinese | Host locale (OS fallback), English, Chinese |
| Theme | System, light, dark | Codex, light, dark |
| Preference storage | desktop_preferences_v1 | codex_preferences_v1 |
| Used space / count / location | Shared SQLite + originals | Same shared root, read-only |
| Move / open storage | Native folder picker | Instructions to use desktop settings |
| Startup / global shortcut | Native Windows | Not shown |
| About | Desktop version + update check | Plugin version; updates managed in Codex |
| GitHub | Hidden until configured | Same product-links.json configuration |

Preferences are strict, transactional partial patches. Separate MCP sessions do not overwrite unrelated fields, and desktop preferences never change with a Codex theme selection. Invalid optional saved values fall back without rewriting them. MCP settings/storage fields are returned in App-only metadata, not model-facing tool text. Storage counts SQLite/journals and regular managed assets without parsing originals or following symlinks.

The shelf remains mounted while Settings is visible. Search, selection and list scroll are retained. The selection bar is hidden immediately, keyboard search is suppressed and late content-editor reads are invalidated while Settings is open.

## Verification

Regression tests: mcp-settings.test.mjs (SQLite persistence, concurrent patches, desktop independence, validation, App-only tool boundary, storage accounting). Native Expansion test covers original-anchor return and moved-panel invalidation alongside existing DPI/monitor centring tests.

Rendered scripts: verify-desktop-settings.js, verify-sidebar-heading.js, verify-mcp-settings.js. These use isolated fixture libraries, not the actual user draft or original files. Native installed-window acceptance is recorded separately in the task result after rebuilding with tauri/custom-protocol.

Recovery copies before replacing the installed app: artifacts/stashdock-before-codex-settings-20261015.exe and artifacts/library-before-codex-settings-20261015.sqlite3. Never restore this database over newer references.

## Completed acceptance

- 272 frontend tests passed; native suites passed (93 library, 2 desktop, 24 helper; one pre-existing ignored clipboard integration test).
- TypeScript, canonical extension-asset parity and Arc token/copy sweeps passed. Existing Arc components were reused; official component markdown was unavailable during this task.
- Desktop settings rendered regression passed. Fixed-header sidebar checked with 31 tags, including scroll, collapse/reopen and a reachable Settings footer.
- MCP settings rendered with the actual App SDK and real isolated SQLite server at 320/390/768/1024/1440px: failed write and retry, persisted preferences after reload, host theme notifications versus explicit overrides, localization, and retained search/selection. No actual Codex draft was used.
- Packaged desktop started with the Vite development server stopped. Installed executable SHA256: 899A7BF1E435E71D642F9CB91E9E1B82874BBB294E34ABEE326BDDD57B25E6BE. Its embedded entry matches dist/assets/index-uAgN4I7P.js.
- Actual native edge test: folder (39,148) expanded into clamped panel position (24,24), then collapsed back to exactly (39,148). After moving the panel to (-227,461), the folder returned to its new centre at (465,787), not the original anchor. Coordinates here are physical pixels from native state; screenshots include platform frame insets.
- Installed native Tags disclosure/scroll also passed: scrolling from the first tags to Codex/Context/Research/GitHub retained the Tags heading and Settings footer at their original positions. The final panel remains open with the library mounted.
- Original library stayed at 46 references. Before/after SHA256 over reference IDs, titles, kind/source/URLs, excerpts/content/tags/context, original/managed file paths, MIME/size and favorites: a07ff65b8ed740ecf8fbc95c7e308c31147fd4c25ce5625fd9ccf35720d8c8a0.
- Installed MCP HTML/server hashes match the build. Existing Codex processes retain their registered tool list; reconnect/restart the plugin and reopen the panel to load the added settings tools.
