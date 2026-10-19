# Desktop web identity and preview feasibility

## Verified existing behavior

Desktop browser import reads bookmark title, URL, folder and date. It does not read the browser favicon cache or render pages. Cards and import rows share saved-favicon metadata followed by four conventional same-origin icon paths. Manual lookup reads HTML-declared icons but currently restricts them to the page origin, missing icons hosted on a CDN. This explains missing icons even where Chrome has one.

Chromium stores page-to-icon mappings and PNG bitmaps in a separate Favicons SQLite cache. Chrome extensions have an official favicon endpoint with the favicon permission. References: [Chromium cache implementation](https://chromium.googlesource.com/chromium/src/+/main/components/favicon/core/favicon_database.cc), [extension favicon API](https://developer.chrome.com/docs/extensions/how-to/ui/favicons).

Read-only local diagnostics found 66 Chrome and 167 Edge web bookmark URLs, but both caches were locked by their owner. No URLs or bitmap contents were printed. No cookie or browsing-history store was queried. This is not a coverage measurement: locked caches prevented checking which bookmarks have bitmaps.

## Original implementation proposal (implemented below)

Favicon lookup: saved image bytes, browser cache (direct read only when available or via the existing extension's official endpoint), HTML-declared icon URL with public-network validation including CDN redirects, conventional image paths, then an honest generic fallback. Retain downloaded bytes locally to avoid depending on remote access at every card render. Deduplicate and bound work by origin. Browser snapshots must preserve SQLite/WAL consistency; copying a live database file alone is not a reliable solution.

No method can guarantee a real icon for every site: missing images, unavailable sites, cleared caches and access restrictions still require a fallback. Do not silently send saved URLs to a third-party favicon service.

Page previews: save first, then enqueue an isolated local headless Chromium render. Capture a consistent desktop viewport after bounded loading; save thumbnail bytes locally and update only the item's preview, never rewrite a stale full-library snapshot. Limit to one active capture initially, prioritize visible new cards, use a total timeout and cancel for deleted references. Keep the browser sandbox enabled and never attach to the user's current browser profile or automatically reuse login cookies. All main-frame redirects and subresource requests need protection from private/local destinations, including DNS rebinding, before this becomes production-ready.

Use a page's declared Open Graph image as a lightweight preview/fallback, not as a purported screenshot. Neither a public cover nor a headless screenshot guarantees access to logged-in, blocked or unavailable content. Login/challenge screens must not be presented as successfully captured saved content.

References: [Playwright browser/headless support](https://playwright.dev/docs/browsers), [screenshots](https://playwright.dev/docs/screenshots), [Open Graph image metadata](https://ogp.me/).

## Proof and shipped correction

- A one-page isolated headless Chrome probe visited a public website and generated output/playwright/headless-public-page.png at 1280 by 800. The headless process and separate user-data directory were verified. The owned browser session was then closed. This proves local no-visible-window capture, not production screenshot integration or broad site compatibility.
- Fixed the desktop Import from trigger to keep one constant label throughout discovery. Previously Finding browsers changed to Import from, invoking Arc label travel and width morph. Arc vendor internals and menus were not modified. Discovery still blocks activation and reports aria-busy.
- A slow-discovery fixture sampled 230 frames over 1.4 seconds: width stayed 151 CSS pixels, visible text stayed Import from, no label translation occurred, and the menu still worked.
- TypeScript production build and 167 frontend tests passed. Native code was unchanged in this correction. Real desktop OS interaction remains unautomated; UI interaction checks use the labelled isolated fixture.

Arc review of the trigger correction: existing DropdownMenu with documented props; consistent sentence-case copy; no new CSS, typography, focus rings or motion overrides; stable component identity; keyboard/menu semantics retained; token/theme/reduced-motion behavior remains with Arc. At that correction's release the favicon and screenshot integrations were still proposals.

## Deployment

The constant-trigger desktop release was built, verified, replaced and restarted on 2026-10-11. Installed executable SHA256: AE24F55E8F0B8E8857FA65A125961FC42FB8CAC52BCE8B7F19D60E8603DE0498. Previous executable: D:/StashDock/artifacts/stashdock-before-import-trigger-fix-20261011.exe.

The user-added library item during this turn was preserved: immediately before and after replacement, 30 items and rows hash 31a75f0931c5a861905384cf418791fcfc063bb89fbcb5a0a21c8d8ab4e62daf; pinned hash 631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864. Codex plugin 0.4.8 was not rebuilt or replaced and its shelf hash remains 405361E7AB5C45D03D80B00C98FD47CB6564EEDB61BB9B1B429D7C21D5E36EED. Both owned browser verification sessions and the Vite server were closed after checks.

## Desktop integration, 2026-10-11

User approved connecting the enrichment pipeline. Link saving remains immediate. A native background worker observes missing web/repository previews, prioritizes newest references and processes one at a time. Its SQLite job state survives restart, retries incomplete work at most three times and cascades on reference deletion. Existing screenshots are not replaced.

- Browser imports opportunistically read exact bookmark favicon mappings from the profile's Favicons SQLite cache in one read-only transaction. Locked/incompatible caches are skipped, not copied or forced open. At most 2,000 bookmarks and 4 MiB of normalized cache images are returned per profile.
- HTML-declared icons, including CDNs, and conventional icon paths are fetched through public-network checks and converted to bounded local PNG data. Raster formats and simple SVGs are supported. SVG image href resolvers and font loading are disabled, so external/local files cannot be loaded by vector conversion. Successful image URLs have a bounded persistent cache.
- Screenshots use the installed Chrome/Edge executable with a unique temporary profile, headless mode and sandbox enabled. A Windows kill-on-close Job Object is assigned while the process is still suspended, before it can create children. The job has a 768 MiB memory limit and runs below normal priority. No user profile, cookies or visible browser window are reused; owned process trees and temporary profiles are cleaned after capture.
- A local proxy has no direct fallback or implicit loopback bypass. Public-only validated DNS addresses are pinned when connecting, including HTTPS tunnels, redirects and subresources. Non-proxied WebRTC UDP and QUIC are disabled. DNS waits, connection count, transfer bytes and capture duration are bounded; non-web/local-file requests are blocked. Standard ports 80/443 only. See [Chromium proxy documentation](https://chromium.googlesource.com/chromium/src/net/%2Bshow/HEAD/docs/proxy.md).
- The isolated page's download behavior is set to deny and its acknowledgement is required before navigation, preventing page scripts from silently saving files to the user's Downloads folder.
- The driver confirms a successful main-document response before capture; failed access/error pages are not knowingly saved as screenshots. A 1280×800 viewport becomes a JPEG thumbnail within the existing preview size cap. If rendering fails, a safely downloaded Open Graph/Twitter cover is attempted and recorded as `previewKind: cover`, not a screenshot.
- Completion rechecks the current reference id/URL and merges only image metadata. It never updates title, tags, favorites, content, context overrides or the search index. A newer extension capture wins. `reference-preview-updated` invalidates the shared desktop store without writing a stale full snapshot.

Limitations: network availability, login walls, bot protection and absent icons/covers prevent guaranteed coverage. No browser runtime is downloaded; Chrome or Edge must be installed for screenshots. Complex SVGs fall back to other icon candidates. Only the desktop executable is updated; no Codex plugin installation or UI redesign is included.

Verification: frontend 170 tests and native 58 tests; isolated public-site headless screenshot and in-memory real pipeline passed. The raster thumbnail was visually inspected. Isolated UI regression passed 320/390/768/1024/1440 widths, tag editing, source grouping, file tags, dirty/stale lookup protection, error recovery, dark theme and reduced motion. Slow discovery sampled 230 frames at constant 152px trigger width. UI checks use the labelled browser fixture, not claimed native OS interaction. Arc components, styles and copy remain unchanged by enrichment.

Final real-site verification also captured uiarc.dev's rendered homepage, including its page images/styles, in approximately 11 seconds, and the in-memory full pipeline passed in approximately 10 seconds. Startup tests under simultaneous release compilation exposed a DevTools endpoint readiness race; the driver now waits for an actual page target after the port file appears instead of treating the initial empty target list as failure. Real-site probes were rerun sequentially and passed. Owned capture processes terminated afterward. Two temporary profiles from the earlier high-load failures remained due Windows file locks; manual cleanup was denied by the execution policy. Capture cleanup now waits longer for handles to close and schedules a bounded cleanup retry for its own exact profile if needed.

Deployment guard: before replacement, 30 references; excluding expected image fields, protected rows SHA256 a3fc8dd969b59ff31f18ed4022da10604a6fb125ad80bd54f49f7a9b6d67db6c; pinned SHA256 631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864. Installed plugin shelf SHA256 remains 405361E7AB5C45D03D80B00C98FD47CB6564EEDB61BB9B1B429D7C21D5E36EED.

Final release built successfully with the NSIS installer and branded PE icon at all nine sizes. Installed/release executable hashes match: D2FE3851B1BC3F1DF033162D11772F24782BF34F0A2892E3EC28D0C0A8C8FBA3. Desktop executable was replaced and restarted; `/v1/health` returned ok. Immediately afterward, all 30 references, protected rows hash and pinned hash above were unchanged. Recovery executable: D:/StashDock/artifacts/stashdock-before-web-previews-20261011.exe. Consistent SQLite recovery snapshot: D:/StashDock/artifacts/library-before-web-previews-20261011.sqlite3. These are backups only and were not restored over live user data.

Live installed-worker verification: 11 jobs completed and one was working at the final check; one previously missing screenshot and eight local favicons had been persisted. The protected 30-reference fingerprint and pinned fingerprint still exactly matched the pre-deployment values after those actual enrichments. The bridge remained healthy and plugin shelf hash was unchanged. The desktop worker remains running to process the rest normally; no verification browser/dev-server sessions remain active.
