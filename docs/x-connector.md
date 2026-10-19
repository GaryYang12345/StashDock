# X import prototype

**Retired on 2026-10-12.** This document is historical, not the current user flow.
The connector is archived and no longer compiled or registered. Use
[single-page browser capture](browser-capture-20261012.md) instead. Existing
references and retired profile data are preserved; no session is reused.

Both desktop and the Codex MCP App use `DesktopImportDialog` → `XImportPanel` → a host adapter → the same Rust connector. There is no Companion dependency, developer API credential form, or cookie-copy instruction.

## User flow

1. Open Import references → Import from → X.
2. Connect X explicitly opens the product-owned browser profile. Complete sign-in and verification in that window.
3. The App polls connection status and reads Bookmarks. Select records, load more, refresh, or import.
4. Preparation reads the selected post's full displayed text and takes an article-only screenshot; failures remain actionable. Saving is a separate atomic library operation.
5. Later visits reopen the protected profile in headless mode. Expiry/challenges prompt reconnection; background preview jobs never open a sign-in window.
6. Disconnect X closes the owned browser and removes that session, not saved references.

## Scope and limits

- Prototype supports Windows, with an installed Chrome or Edge. A full-browser fallback hook exists, but is deliberately not shipped until its exact binary and complete license inventory pass verification. The already-bundled public headless screenshot/PDF runtime remains available without a user browser; it is not a visible login window.
- The attempted official unbranded Chromium snapshot r1716555 was hash-verified but has a stub Credits page. The preparer fails closed instead of silently shipping incomplete third-party notices. Its development download is not an installation artifact.
- X bookmarks are read through rendered, user-authorized pages, not undocumented request signatures. DOM selectors can change. Login/verification and actual account/bookmark acceptance must be checked on X; fixtures are not evidence of real-account success.
- The previous connector incorrectly used the public screenshot proxy: local DNS IP pinning broke X CDN access through the user's VPN, and the guard mapped connection failures to HTTP 403. That result was not evidence of X account challenges. Connected browsers now use normal Chrome/Edge system-network handling. Actual account/bookmark and signed-in background reuse remain acceptance gates, not guaranteed capabilities.
- A page is not a transcript: video/audio transcription and OCR are outside this prototype. Removed/restricted posts and incomplete long posts fail preparation rather than silently creating blank references.
- Content scope is the selected post's displayed text, shown quote and linked-card description. It does not recursively import a full conversation thread, linked external articles, or a separate X Article body.
- List and selection are bounded to 500 records per pass; prepare requests contain up to three IDs. A refresh invalidates old cursors, including cursors from another open host. Imports deduplicate existing post IDs across x.com/twitter.com aliases.
- Explicitly connected X browsers use Chrome/Edge's normal system proxy, PAC and DNS handling, without a custom proxy or local-IP pinning. Connector navigation is allowlisted to X post/sign-in/bookmark URLs. X must still be reachable using that browser's network settings; daily-profile-only VPN extensions are not copied, and regional restrictions/account challenges are not bypassed.
- Unauthenticated screenshots of arbitrary public links still use the existing public-only network guard. A platform connection is a separate trust boundary, not a reason to relax the public preview pipeline.

## Session and lifetime

The trusted data root holds `connections/x/profile`; access is restricted to the current Windows user and SYSTEM. Password fields are never inspected. Chromium manages its own cookie encryption. Browser profiles and engine families are not portable across OS users.

One shared worker owns the profile and caches only bookmark IDs/visible content. It binds an ephemeral loopback endpoint with a random secret, rejects browser Origins, validates a narrow X operation/URL allowlist, and uses an OS-owned exclusive file lock. Its endpoint secret is never returned to the App or model.

The prototype's Chrome debugging transport is also loopback-only, but assumes a trusted local workstation; file ACLs do not authenticate Chrome's TCP debug socket to other local processes/users. A pipe-based, user-isolated debugging transport remains a hardening gate for production/shared-workstation deployment.

The worker is launched through the Windows shell parent, outside the Codex/launcher Job Object. Each browser has its own bounded kill-on-close job, with no implicit downloads. After 15 idle minutes the worker closes the browser gracefully to flush persistent cookies. MCP shutdown aborts short-lived request helpers, not the session worker or desktop application.

The server exposes connection operations only as App-visible tools. Private preview bodies remain in `_meta`, not model-facing tool text. Saved references contain the selected content, provenance and raster screenshot, never session credentials.

## Build and verification

2026-10-12 simplified-network acceptance: the native visible Connect path rendered X's current `username_or_email` / `username webauthn` sign-in input using an empty disposable profile and the enabled Windows system proxy. An isolated fixture cookie survived closing/reopening Chrome. All 95 native regressions and 220 frontend tests passed; both hosts' import fixtures passed light/dark and five widths. This verifies browser networking and persistence, not a real user's completed sign-in or bookmark import. Actual-account acceptance remains outstanding.

- `npm run test:frontend`, `npm run desktop:test`, `npm run build`, `npm run plugin:build`.
- `STASHDOCK_X_BROWSER_SMOKE=1` and a trusted `STASHDOCK_CONNECTION_BROWSER` executable opt into a real, isolated persistent-cookie test; it uses only a fixture cookie on example.org, never a real account.
- `STASHDOCK_X_LOGIN_SMOKE=1` opts into a disposable visible X sign-in test. It checks that CDN scripts load and the username input renders; it neither fills fields nor accesses the user's saved profile.
- UI fixtures explicitly simulate X and do not contact it. Check both hosts, light/dark themes, narrow widths, loading, expired sign-in, preparation failure/cancel, selection and save.
- `scripts/prepare-connection-runtime.ps1` is an experimental fail-closed qualification tool, not a dependency of the current prototype installer.
