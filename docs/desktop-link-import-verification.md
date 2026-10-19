# Desktop Link import

Scope: desktop dashboard only. Codex MCP App continues to use its existing AddDialog and installed plugin 0.4.8.

## Experience

- Three categories: Link, Note, File. Link is the default. Removed the separate Bookmarks category and HTML-export instructions from the desktop UI.
- The Link entry starts with a URL and Import from. Valid URL input reveals editable title, content and tags. Lookups are debounced, stale responses are ignored and user edits are never overwritten.
- Import from identifies Chrome, Edge and Firefox with brand marks and app names only. Each app combines its supported local profiles into one checklist, initially selecting unsaved links. Existing library URLs are marked Saved and cannot be imported twice. There is no bookmark search field or batch tag control.
- Bookmark rows reuse the same lazy SiteFavicon component and bounded same-origin fallback paths as dashboard cards. Unavailable favicons retain the same initial-letter fallback.
- Manual Link, Note and File reuse Arc TagInput and existing-tag suggestions, with the Enter-only adapter already used by the card editor. Suggestions remain visible after selection. Explicit file tags are validated before copying and saved within the native import transaction. Calls that omit tags retain legacy file-type tagging.
- Large lists render 100 entries at a time; selection covers the whole collection. New imports use the StashDock addition time for Recent; original browser saved dates and folder provenance remain in origin metadata.
- Save succeeds in place and closes the dialog. Failed saves retain drafts. Switching Link/Note preserves each text draft.

Arc primitives: existing Tabs, Input, Textarea, TagInput, DropdownMenu, Button, Skeleton, Alert and FluidDialog adapter. Installed the official free Arc Checkbox through the shadcn CLI; did not fork its internals. Browser marks identify actual local sources, not advertised integrations.

## Native implementation

- Native commands: list_browser_sources, read_browser_bookmarks and preview_link. They run blocking filesystem/network work off the UI thread.
- Chrome/Edge read the local Bookmarks JSON. Firefox queries only bookmarked rows and their folder ancestry using a read-only SQLite connection. Cookie stores, sign-in credentials and history queries are not accessed.
- Source IDs are resolved against rediscovered supported browser roots, not accepted as arbitrary filesystem paths. Standard Windows profile locations are supported; custom portable browser locations and social-platform account integrations are not yet supported.
- Folder path and original save date are retained. Automatic bookmark imports preserve actual title/URL metadata; they do not claim to contain webpage body text. The manual Link lookup extracts public HTML title, main/article text or description, and same-origin favicon metadata. No authenticated browser session is reused.
- Network lookup validates HTTP/S, credentials, resolved public IPs and every redirect, pins validated DNS results and bypasses environment proxies. Responses and extracted content are bounded. Login-protected, script-only or unreachable pages can be entered manually.
- Existing storage, canonical duplicate handling and final context formatting remain the source of truth. A note now saves its actual content, not only an excerpt.

Implementation references: [Chromium bookmark codec](https://chromium.googlesource.com/chromium/chromium/+/master/chrome/browser/bookmarks/bookmark_codec.cc), [Mozilla Places schema](https://searchfox.org/firefox-main/source/toolkit/components/places/nsPlacesTables.h), [reqwest ClientBuilder](https://docs.rs/reqwest/latest/reqwest/blocking/struct.ClientBuilder.html).

## Verification

- TypeScript production build succeeded; 166 frontend tests passed.
- 47 native tests passed, including synthetic Chromium and Firefox adapters, original-file byte equality, plain-text extraction, profile discovery and local-network rejection. New file-tag coverage verifies validation before copying, normalized tags after storage, explicit empty tags and legacy omitted tags.
- Explicit live native smoke verified a public Example Domain title and read 66 Chrome, 167 Edge and 191 Firefox web bookmarks from three actual profiles. Titles, URLs and profile paths were omitted from logs. Nothing was imported into the real StashDock library.
- Browser interaction checks used an explicitly labelled isolated fixture with simulated platform/web/file services and favicon responses, with no real collection writes. Selective import, saved-URL exclusion, profile grouping, pagination, no batch search/tags, shared favicon loading, manual/file tag payloads, user-edit protection, stale lookup cancellation, Enter-only tags, draft preservation, manual recovery, failed-save retention and successful close all passed.
- Empty, selected-browser and manual-detail views checked at 320, 390, 768, 1024 and 1440px. Forms also checked at 684px viewport height. No horizontal overflow. Dark/blue and reduced-motion checks passed.
- Source sweep found no decorative copy, raw CSS colors, competing font/padding overrides or hand-made focus rings in the new business surface. Existing overlay accessibility/focus ownership remains with Radix/Arc.
- Real library before verification: 29 items; rows hash 41a7b4d6bff297022d9c03da92edd08d3f789b34a43cc26a59c3936d0158d280; pinned hash 631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864.

Browser screenshots are under output/playwright/import-*.png. Native UI interaction was not exercised through OS automation; native backend smoke plus browser-layout/interaction coverage are reported separately.

## Deployment — 2026-10-11

- Final desktop release and NSIS installer built successfully; embedded Windows icon sizes all match the brand.
- Replaced D:/StashDock/stashdock.exe and restarted that exact application only. Installed SHA256: F565220CEF2F81D15FBF532BC8F21D74957326D91C752DA643E51BC081C334BE.
- Recoverable previous executable: D:/StashDock/artifacts/stashdock-before-link-import-20261011.exe.
- After restart the real library still contains 29 items, with identical rows and pinned hashes recorded above.
- Installed MCP App 0.4.8 shelf.html remains unchanged: SHA256 405361E7AB5C45D03D80B00C98FD47CB6564EEDB61BB9B1B429D7C21D5E36EED.

## Follow-up import polish — 2026-10-11

Arc review: all applicable type/copy, semantic token, layout, component/API, state, React, keyboard/focus and responsive checks passed. Tabs compose a horizontal icon/label child, without changing vendor internals. Icons stay inside their trigger and vertically align with the text at all five tested widths. Removed redundant file-preservation copy. Existing Arc components still own reduced motion, focus trapping and keyboard semantics.

Native UI interaction remains unautomated; the file chooser is exercised through a simulated fixture adapter, with its actual tag-validation/storage implementation independently covered by native tests. An initial browser-check run was interrupted by the packaging asset refresh reloading the Vite fixture; the clean rerun passed with zero console errors and the expected reduced-motion warning.

Follow-up release installed and restarted successfully. Installed SHA256: 989DF8E5074ABE3EC43BDAAC13824E56D5377BE1F91AD72905D997731B437C9D. Previous executable preserved at D:/StashDock/artifacts/stashdock-before-import-polish-20261011.exe. Windows brand icon verification passed. Actual library count and hashes remain identical to the 29-item baseline; installed MCP shelf hash remains unchanged.
