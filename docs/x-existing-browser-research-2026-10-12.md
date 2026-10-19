# X imports through the user's existing browser

**Superseded product decision:** platform-wide imports and browser-debugging
connections are not being shipped. This research is historical. The active flow
is [explicit single-page extension capture](browser-capture-20261012.md).

Research date: 2026-10-12. Product decision: no paid X API; connect to an
existing, explicitly authorized browser session instead of prompting for a
second X login in a StashDock-owned profile.

## Evidence and recommendation

Twenty returned Exa search results were reviewed across browser connection,
bookmark exporters, and unofficial API libraries. Original repository docs,
selected implementation files, license files, and npm package metadata were
checked. This is a source-based assessment, not authenticated X acceptance.
Anonymous GitHub API rate limits prevented reliable live commit/archival
metadata checks; repository popularity is not used as a reliability guarantee.

| Project | Actual mechanism | Fit for StashDock |
| --- | --- | --- |
| [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Existing Chrome 144+ connection with browser consent; Apache-2.0. The browser connection code distinguishes launched and connected browsers. | Reference the connection mechanism, not an unrestricted model-facing browser tool. Chrome is the officially supported browser; do not promise Edge/Safari compatibility. |
| [Bookmark X](https://github.com/LucasDitchun/export-bookmarks-x-twitter) | MIT Chrome extension; explicitly initiated DOM capture of the signed-in bookmarks timeline, deduplication, bounded batches, and stable-end checks. Its privacy documentation excludes cookie/token/password collection. | Best reference for credential-free DOM collection and honest incomplete-run handling. Detail pages are still needed when visible text is truncated. |
| [xarchive](https://github.com/sytelus/xarchive) | MIT extension; private GraphQL pagination and folders. Its service worker captures and persists authentication-related headers; manifest includes cookies and webRequest. | Reference schemas/pagination semantics only. Do not copy its credential capture/replay architecture. Its own maintenance guide does not guarantee rate-limit acceptance. |
| [bookmark-eXport](https://github.com/pauljump/bookmark-eXport) | MIT Python/Playwright tool; listens to GraphQL responses the real page loads and optionally visits details for expanded text. Its launch requires supplied session cookies in a separate headless browser. | Reference passive response parsing; replace authentication/launch with the authorized existing browser. Do not require users to copy cookies. |
| [Twikit](https://github.com/d60/twikit) | MIT Python private-API client; provides login/session-cookie APIs rather than an existing-browser connection. | Not the default transport. It reintroduces credential/session handling and private endpoint maintenance. |
| [Bird](https://www.npmjs.com/package/@steipete/bird) | Private GraphQL CLI with browser-cookie extraction. The live npm latest metadata for 0.8.0 explicitly marks the package unsupported. | Do not depend on it for the product's default importer. Community mirrors do not establish maintained upstream support. |
| [xbook](https://github.com/joedanz/xbook) | Its non-API Chrome path is documented as macOS-only. The current license is FSL-1.1-MIT, not an unconditional current MIT license. | Do not adopt as a cross-platform importer or assume its code is freely reusable in a competing commercial product. |

Primary supporting sources:

- [Chrome's existing-session connection flow](https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session): enable remote debugging once, then grant each requested debugging session. Authorization is browser-wide, not an X-only browser permission.
- [Browser connection implementation](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/src/browser.ts): connection options, channel discovery, and connected/owned lifecycle distinctions.
- [Bookmark X extraction design](https://github.com/LucasDitchun/export-bookmarks-x-twitter/blob/main/docs/SCRAPING.md) and [privacy policy](https://github.com/LucasDitchun/export-bookmarks-x-twitter/blob/main/PRIVACY.md).
- [xarchive header collection](https://github.com/sytelus/xarchive/blob/main/background.js) and [maintenance/partial-failure guidance](https://github.com/sytelus/xarchive/blob/main/docs/maintenance.md).
- [bookmark-eXport response parsing/authentication code](https://github.com/pauljump/bookmark-eXport/blob/main/scrape.py).
- [Bird's live npm metadata](https://registry.npmjs.org/@steipete%2Fbird/latest).
- [xbook license](https://github.com/joedanz/xbook/blob/main/LICENSE).

## Proposed common transport

1. Explicit Connect X requests consent to connect to the user's existing
   Chrome. No paid API, password form, copied browser profile, cookie export,
   silent fallback to a fresh sign-in window, or user-written MCP configuration.
2. Create a StashDock-owned bookmarks tab in that browser. Do not enumerate or
   inspect unrelated tab content. A broad browser debugging grant must be
   accurately disclosed even though StashDock's implementation limits its use.
3. Read only normal bookmark/detail page content and the successful bookmark
   responses generated by those pages. Do not synthesize transaction IDs,
   capture auth headers, or replay private requests from a standalone client.
4. Normalize only allowed reference fields: post ID, canonical URL, author,
   published date, actual text, quote/card data and media URLs. Never persist
   raw browser protocol/network events, request headers, or session material in
   references, logs, MCP output, or model context.
5. Collect serially with bounded page/time/size budgets and cancellation.
   Deduplicate IDs. Authentication expiry, verification, HTTP 403/429, parser
   changes and pagination stalls report an incomplete result, not successful
   full coverage. Do not bypass challenges or guarantee an account cannot be
   limited.
6. Prepare only selected references, obtaining expanded content and an
   article-region screenshot in owned tabs. Continue using the shared import
   panel and independent native worker for desktop and the Codex App.
7. Disconnect only detaches the connection and closes StashDock-owned tabs.
   Never close the user's browser, terminate its process, clear its X session,
   delete its profile, or put it in an owned kill-on-close Job Object. Existing
   references remain unchanged.

DOM collection is an alternative when passive structured responses cannot be
parsed; it does not turn incomplete or truncated data into complete content.
Neither mechanism guarantees access to every historical/deleted/restricted
bookmark. All captured data stays local except when the user explicitly adds
chosen references to AI context.

## Browser support and acceptance gates

- Current test machine: installed Chrome 154, which meets the documented
  Chrome 144+ version requirement. A DevTools connection descriptor exists;
  that alone does not prove permission is active or connection is authorized.
- The user agreed to enable the setting and report back. Wait for that
  confirmation and Chrome's Allow consent before real-account verification.
- Chrome connection/collection is the first implementation target. Edge,
  Firefox and Safari need separately verified transports. A scoped extension
  is a possible later adapter, not a silently introduced prerequisite.
- Tests must prove normal already-signed-in access, accurate partial/loading
  states, cancellation, account/profile mismatch behavior, no duplicate imports,
  screenshot availability, host consistency and disconnect without touching
  the daily browser or login state.
- No authenticated bookmark read, source dependency installation, daily-browser
  attachment, or production importer replacement was performed during this
  research. Existing StashDock installation/library/session data was preserved.

There is no official API usage charge on this route. It still has engineering
maintenance and account/platform-policy risk; open source is not permission to
bypass X restrictions or a promise of permanent compatibility.
