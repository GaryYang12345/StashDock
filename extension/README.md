# StashDock Companion

The toolbar opens the browser's native Save page sidebar. It reads the current
website using your existing browser login. Review the title and content, choose
or create tags, then click Save page. A successful durable save confirms in place and keeps the sidebar open.
Closing without Save does not add a reference. There is no webpage overlay, shelf,
Settings screen or automatic setup tab. If a local provider is unavailable, open
StashDock Desktop or its AI plugin and use Check again in the Save form.

## Install or update

Build with `npm run extension:build`. One shared source tree generates
`output/extensions/chrome`, `edge` and `firefox`; do not copy a Chromium manifest
into Firefox. No extension Settings page or automatic setup tab is added.

- Chrome 141+: open `chrome://extensions`, enable Developer mode, Load unpacked,
  then choose `output/extensions/chrome`. Existing local development installs can
  continue using `extension/` so their ID and pending drafts remain unchanged.
- Edge 141+: open `edge://extensions`, enable Developer mode, Load unpacked,
  then choose `output/extensions/edge`.
- Firefox 153+ (including current ESR): open `about:debugging#/runtime/this-firefox`,
  choose Load Temporary Add-on, then `output/extensions/firefox/manifest.json`.
  This is a development installation, removed when Firefox exits. Permanent
  distribution requires Mozilla signing or an AMO release; an unsigned archive
  is not a permanently installable XPI. Do not disable signature enforcement.

After an update, reload the extension. Pin StashDock Companion and click its
toolbar icon on the website you want to save. Approve website access in the
browser's own dialog. There is no StashDock sign-in or browser-profile setup.

Chromium uses `sidePanel`; Firefox uses its native `sidebarAction` and an MV3
module event page. Website access still uses explicit optional website-access
consent. Required host permissions
remain localhost-only; there are no bookmarks, history, cookies or debugging permissions.
Open StashDock desktop or its Codex plugin for shared-library synchronization.
If Chrome requests local-network access, allow the local library bridge.
The Firefox manifest declares page content and current-page URL transmission to
the local StashDock provider. No telemetry, browsing-history collection, cookies
or remote upload service is added. Private-window capture is not enabled.

## Capture and save boundaries

- The toolbar gesture opens the sidebar and requests optional website access.
  With consent, the open sidebar automatically reads its window's active web page
  on tab/navigation changes, including late-rendered post content. Closing stops reads.
- Generic article extraction plus isolated X, Xiaohongshu and Zhihu adapters.
  Additional platform navigation entries do not imply dedicated extraction or
  complete support. Automatic capture reads the page/post, not an incidental text selection.
- Expand long posts first. Hidden text, private drafts, unrelated feed posts,
  unloaded comments and audio/video transcripts are not inferred.
- Tab/URL checks surround extraction and screenshot. Capture includes only web-tab
  contents, never the native sidebar. Images are cropped and resized.
- The extension-origin sidebar and originating window/tab/capture token authorize
  worker requests. Session drafts survive worker suspension, not browser restart.
- Only Save commits. Errors remain inline and keep the current draft open. Save
  needs a running current local provider; no automatic mutation replay on timeout.
- Save checks only the current canonical URL. Existing pages show Replace saved
  page? with Keep existing / Replace page. Replacement updates title, body, tags
  and cover while retaining ID, creation time, favorite and separate AI context.
  The provider rechecks the confirmed revision transactionally; concurrent edits
  require a new confirmation. Explicit retries reuse a compact bounded receipt.
- No whole-library download or browser shelf cache. Only tag names persist for
  offline editing. Upgrade removes cached shelf rows, preserving unfinished
  legacy imports/edits/deletions for recovery without a whole-library read.

## Shared UI

The sidebar uses the same Arc fields, circular icon-only buttons, tag picker, black hints and native
scrollbar stylesheet as desktop/Codex import forms. Save stays visible when the
body scrolls. No AI actions, bookmark import, library cards or draggable card.

Run npm run assets:ui to regenerate local UI assets; assets:ui:check detects drift.
Dependency notices ship in ui/notices.

## Verification

Shared capture/session/transport tests run with `npm run test:frontend`.
`tests/browser-targets.test.mjs` covers manifests, sidebar adapters, origin/runtime
IDs, provider registration and disable/uninstall detection.
`web-ext lint --source-dir output/extensions/firefox` validates the Firefox
package. Keep dependency warnings distinct from application errors; do not edit
or suppress third-party React/Readability source merely to remove linter output.
`verify-firefox-runtime.mjs` uses a disposable Firefox profile, an isolated
loopback fixture and no real library writes. It never grants broad website
access; permission-gated checks are reported, not called successful extraction.
Signed-in websites and the full sidebar gesture/access/Save flow still require
manual acceptance in each browser after its native permission prompt.
