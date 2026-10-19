# Tags and independent screenshot runtime

## Interface

Desktop and MCP import/edit forms compose the same `ReferenceTagsField`, using the installed Arc TagInput, Popover, ScrollArea, Input and Button. Existing tags are collapsed by default. Typing never opens the picker. Choose tags opens a portaled, collision-aware surface with bounded scrolling; collections above 12 tags have search. Added suggestions remain visible with a check. Escape closes only the picker and returns focus; saves close the parent editor. The tag draft and canonical-name validation remain owned by the form.

Checks: actual rendered import and editor fixtures with 83 tags at 320, 390, 768, 1024 and 1440 pixels. Picker boundaries and unchanged form height are asserted. The shared MCP import regression covers both themes, neutral/blue accents and those five widths. Fixtures simulate browser imports; screenshot integration below does not simulate rendering. No separate lint task is configured; TypeScript, source guards and browser checks are used.

## Distribution decision

The user selected bundling the screenshot runtime, rather than a first-use download. Windows packages include Google Chrome for Testing Headless Shell 155.0.8059.39, downloaded from Google's official HTTPS endpoint. The archive's server-provided length/digest are checked while streaming; a SHA-256 inventory covers every shipped runtime file. The upstream license is included. MCP startup verifies the inventory before running the engine, and publishing fails if the runtime is absent, mismatched or damaged. The native installer includes the same runtime as a mapped resource, and the native launcher uses the adjacent product-owned engine before system Chrome/Edge.

The runtime archive is about 119 MiB. There is no automatic runtime download/update on a user's machine, and no cloud screenshot service. A release must deliberately refresh and verify the pinned runtime. The manifest checksum detects damaged/modified files; it is not a replacement for signed product releases.

## Backend

The standalone `stashdock-preview` binary includes the existing public-web proxy, browser isolation and image decoder modules by reference. It has no desktop window, SQLite library access or Tauri runtime dependency at execution time. The MCP server launches it over bounded JSON stdin/stdout with a 55-second outer deadline. Browser startup and rendering have their own shorter deadline.

- Fresh temporary profile; no user cookies, extensions, history or login session.
- Browser sandbox stays enabled. Windows Job Objects terminate the owned browser tree, including after renderer/helper termination.
- Checked public DNS results are pinned to connections. The proxy covers redirects, page subresources and workers. Private addresses, special protocols, credentials and nonstandard ports are blocked; downloads are denied; QUIC and non-proxied WebRTC are disabled.
- Screenshot first, then a public Open Graph/Twitter cover image if rendering fails. Images are decoded, size-bounded and converted to inert JPEG/PNG before storing.
- SQLite lease selects one consumer across desktop and MCP conversations. Atomic claims, lease expiry, persistent retries and a three-attempt limit prevent duplicated work and indefinite loading.
- Completed work only merges preview/favicon metadata by ID plus current URL. Deleted references are not re-created, existing images are not overwritten, and titles, tags, favorites and model content stay intact.
- A new bundled runtime requeues previously exhausted image failures once. The version marker prevents retries from resetting on every launch.

Real integration: `scripts/verify-independent-preview.mjs` starts the packaged MCP server against a fresh isolated database, observes working/ready states, receives an embedded screenshot, and verifies the original content/tags/favorite. It never uses the desktop bridge or an installed user browser. `scripts/verify-tags-picker.js` and the existing desktop/MCP import scripts verify the interface without writing to the user collection.

## Cross-platform boundary

This release is built and tested for Windows x64 only. Safari must not be treated as a drop-in headless Chromium executable. Apple Safari automation requires its WebDriver setup; Playwright explicitly uses its own patched WebKit, not installed Safari:

- https://developer.apple.com/documentation/safari-developer-tools/macos-enabling-webdriver
- https://playwright.dev/docs/browsers#webkit

For a Mac release, ship a matching macOS helper plus a separately pinned, verified mac-arm64/mac-x64 runtime; implement platform-owned process-tree cleanup and the correct bundle resource location; verify sandbox, public-only networking, cancellation and actual captures on Macs. The build currently refuses to publish an unsupported MCP platform, and native capture reports Windows-only on other systems. No claim of working Safari/macOS screenshots is made.

Bundling removes the browser-installation dependency, not the need to reach the website. Login walls, anti-bot pages, missing cover images and unavailable sites can still prevent a usable picture. Do not fabricate an image or leave such entries loading forever.

## Release verification (2026-10-11)

MCP 0.4.15 / shelf-v17 is installed and verified. The packaged independent worker captured a real page without a desktop bridge or system browser, preserving content, tags and favorites. Native tests passed (59 app tests and 5 helper tests). The Windows installer is 130.50 MiB with the bundled runtime; the desktop executable was replaced and restarted, its API health passed, and the 33-reference content/pinned fingerprints remained unchanged. Brand icons passed all nine embedded sizes. The verified runtime archive and consistent library/executable backups remain available.
