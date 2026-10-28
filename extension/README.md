# StashDock Chrome extension

Save the page you are reading as reusable AI context. Open the extension from
the Chrome toolbar, review the title and content, choose tags, then Save page.

## Installation

Install and open a matching StashDock Desktop or AI plugin once. The native save
component is included with either product. Follow the installation steps for
the release you downloaded.

Use the Chrome Web Store listing when available. For manual installation:

1. Download the Chrome extension ZIP from Releases and extract it to a permanent folder.
2. Open chrome://extensions and enable Developer mode.
3. Choose Load unpacked and select the folder containing manifest.json.
4. Pin StashDock, open a webpage and approve the requested page access.

For unpacked updates, replace files in that folder, choose Reload, then reopen
the sidebar. The store identity stays the same across versions and operating systems.

## Bookmarks

Import bookmarks from Chrome, Edge, Firefox or Safari directly in StashDock.
Bookmark import does not need an extension. The Chrome extension saves the
current page; it does not import browser bookmarks.

## Build

Run npm run extension:build to generate output/extensions/chrome.
Public releases contain this Chrome package. Capture, forms and native save
transactions share the application's canonical source and local library.

Required host permissions are localhost-only. Website access is requested
explicitly; no cookies, browsing history, bookmarks or debugging permissions are
required. No telemetry or remote upload service is added.

Duplicate URLs show Keep existing / Replace page. Replace uses the current save
result; cancellation preserves the existing reference. Save is never replayed
automatically after a timeout.
