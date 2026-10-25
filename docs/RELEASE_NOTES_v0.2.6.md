# StashDock v0.2.6 for Windows

This release brings the current Windows desktop app, ChatGPT plugin and three
browser extensions together in one verified set of packages.

| Component | Version | Package |
| --- | --- | --- |
| Desktop | 0.2.6 | `StashDock_0.2.6_x64-setup.exe` |
| ChatGPT local plugin | 0.4.35 | `stashdock-plugin-0.4.35-win32-x64.zip` |
| Chrome extension | 0.4.16 | `stashdock-extension-chrome-0.4.16.zip` |
| Edge extension | 0.4.16 | `stashdock-extension-edge-0.4.16.zip` |
| Firefox extension | 0.4.16 | `stashdock-extension-firefox-0.4.16.zip` |

## Changes

- Current desktop and ChatGPT library improvements, including compact shelf
  reads, virtualized desktop cards, clearer errors and floating-folder search.
- Better X Article capture, including read-only rich text and correct source
  matching when an article contains quoted posts.
- One shared capture implementation and generated packages for Chrome, Edge and
  Firefox.
- Updated website source with real reference examples, editable demo cards,
  source links and a bilingual installation guide with a replayable tutorial.

## Install or update

- Desktop: run the Windows installer. The installer handles the system WebView2
  prerequisite. Existing references remain in the local library.
- ChatGPT: extract the **complete plugin ZIP**, register its local marketplace
  and install `stashdock@personal`. The package includes Node and native helpers;
  a GitHub Source code archive is not an installable replacement. See
  [plugin installation](windows-plugin-install.md).
- Chrome and Edge: extract the matching browser ZIP to a permanent folder and
  load it from the browser's extensions page in Developer mode. For an existing
  unpacked installation, replace its files, choose Reload, then refresh the page.
- Firefox: use Load Temporary Add-on at
  `about:debugging#/runtime/this-firefox`, selecting `manifest.json`. This unsigned
  development installation is removed when Firefox closes.

Desktop and the ChatGPT plugin can be installed separately or together. Browser
saving needs one local provider running. Keep all components current when updating.

## Availability

- Windows x64. macOS packages and Safari are not included.
- The Windows installer is not code-signed. The browser extensions are manual
  packages, not official store listings. Firefox signing is still pending.
- Claude remains Coming soon; no Claude package is published in this release.
- `SHA256SUMS.txt` and `release.json` identify the exact downloadable files and
  source commit. The plugin also includes a per-file `RELEASE_MANIFEST.json`.

See [Windows installation](INSTALL_WINDOWS.md) for setup and prerequisites.
