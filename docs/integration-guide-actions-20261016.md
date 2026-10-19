# Integration guide actions

Supersedes the row placement and footer behavior in settings-copy-guides-20261016.md.

## Product behavior

- Detected sits immediately left of View guide, vertically centered with the
  button. Brand names remain single-line; peer rows retain matching heights.
  Missing StashDock registration shows Set up, not Detected. This is plugin
  detection, not a claim that the host desktop client is installed.
- Usage and setup guides put a brand-marked Open app button at bottom right.
  On Windows, registered clients take priority over configured official websites.
  ChatGPT supports the current chatgpt/codex protocol registrations; internal
  compatibility IDs remain unchanged. Chrome uses Windows App Paths.
- Desktop opens only its validated, registered stashdock.exe path. If absent,
  its real configured download/repository URL is used. No published Desktop URL
  exists yet, so unavailable download actions remain disabled.
- Setup without a marketplace link offers GitHub Copy. The real repository is
  still unset, so Copy is disabled with an explanatory shared tooltip. Once
  configured, the existing copy-feedback hook supplies green Copied, reset and
  clipboard-error behavior. No fabricated URL or success state ships.
- Claude has a Set up preview and an explicit Coming soon label. Its integration
  is not implemented. Opening Claude itself remains available.
- Desktop, embedded AI panel and connected browser setup reuse IntegrationGuide,
  Arc Button/Alert, FluidDialog and the canonical tooltip/copy-feedback system.
  Browser setup without a local provider uses the official website; non-Windows
  launch currently falls back to websites rather than claiming native detection.

## Engineering boundaries

- Frontends submit one fixed integration ID, never executable paths or commands.
  Native and Node launchers use one product-links.json configuration.
- The Node launcher dispatches through the OS without a shell or inherited stdio.
  The native launcher uses ShellExecute. Desktop lifetime remains independent of
  the AI host. No cookies, browser profiles or login data are inspected.
- MCP launch is app-only, non-idempotent and open-world. The browser bridge keeps
  existing origin/Host/header checks, bounds the payload and rejects extra keys.
  Opening an app is not automatically replayed after an ambiguous timeout.
- GitHub uses the unchanged upstream Simple Icons CC0 mark, with provenance in
  src/assets/brands/README.md and the existing bundled license notice.

## Acceptance

- TypeScript and generated browser UI parity checks passed. Semantic CSS sweeps
  found no new raw colors, custom focus rings, decorative gradients or heavy type.
- Frontend: 289 passed, zero failed. Native: 127 passed, zero failed; one existing
  interactive clipboard test remains ignored.
- Desktop fixtures: both themes, 320/390/768/1024/1440 widths, status/button
  alignment, equal peer heights, no overflow, all logos, Claude preview,
  unconfigured URL states, async launch failure/retry and undetected setup.
- Copy success, green feedback, reset and error were exercised using an isolated
  fake clipboard and a clearly reserved test URL. The user's clipboard was not
  modified. Production configuration still contains no repository URL.
- Packaged MCP HTML through the real SDK and an isolated library: Chrome/Desktop
  guide actions invoked the correct tool/ID; black tooltips, focus return, five
  widths, saved preferences, failure/retry, host theme override and preserved
  search/selection passed. App launching was intercepted in the test harness;
  the actual ChatGPT/Codex host UI was not automated.
- Installed plugin bundle was imported independently from its cache and exposed
  the new fixed-ID app action. Server, HTML and both helper hashes match source.
- Installed Desktop cold-started with Vite stopped. Its 46 references, settings,
  aligned ChatGPT/Claude rows and settled Claude setup footer were inspected.
  Read-only Windows resolution found codex:// and Claude's website fallback.
  Actual external client startup was not automated.
- Desktop embedded entry: index-CCSFnQeA.js. Installed executable SHA-256:
  3484EC262781B9DDDB07B847D1C1E8F0D1FA434E2A278A8788CA1F905C13CDF8.
- Packaged HTML SHA-256:
  ABFFF5283A72179365ABA26AE65D2508DB4F6483408525BC5D660BFE15AE9376.
- Reference signature remains unchanged:
  a07ff65b8ed740ecf8fbc95c7e308c31147fd4c25ce5625fd9ccf35720d8c8a0.
- Recovery snapshots: artifacts/stashdock-before-integration-actions-20261016.exe
  and artifacts/library-before-integration-actions-20261016.sqlite3.

Arc review passed for the changed surfaces. Existing compact help controls retain
their established target sizes; keyboard focus, tooltip access and reduced motion
are preserved. Restart/reconnect the plugin to load shelf-v43; reload the browser
extension to load its updated worker and setup UI.
