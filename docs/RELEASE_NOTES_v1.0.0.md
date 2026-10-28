# StashDock 1.0.0 for Windows

StashDock is a local library of the context you give to AI: pages, links, files,
notes, prompts and rules. Save it once, then add it to any chat.

This release brings StashDock Desktop, the ChatGPT plugin and the Chrome
extension to 1.0.0. Setup guides are at [stashdock.app/guide](https://stashdock.app/guide).

## What's included

- **StashDock Desktop**: a standalone app for browsing, organizing and handing
  references to any AI. Copy or drag a card into a chat; files go as originals
  with their context. Minimize to the floating folder, hover it to search, and
  copy or drag a result without opening the library.
- **ChatGPT plugin**: opens your library in ChatGPT's side panel. Select
  references and click Add to chat, or ask ChatGPT to find, organize and save
  references for you.
- **Chrome extension**: saves the page you are reading, with its title, text and
  link. Works with Desktop or the plugin installed, even when both are closed.

Desktop and the plugin share one library on your computer. Install either or both.

## Changes since 0.2.6

- The Chrome extension saves pages while Desktop and ChatGPT are closed. Desktop
  and the plugin each register a small component that Chrome starts on demand;
  there is no background service.
- Save the context combinations you use as a tag and add them to any chat in one click.
- Replacing a saved link now replaces the whole reference with the current page,
  in the extension and in Desktop or plugin imports.
- Link previews work behind a proxy client in TUN mode, not only with a system proxy.
- Setup buttons in Settings open the matching section of the website guide.
- Chrome is the published browser extension. Bookmark import still reads Chrome,
  Edge, Firefox and Safari without an extension.

## Packages

| File | Use |
| --- | --- |
| `StashDock_1.0.0_x64-setup.exe` | StashDock Desktop for Windows 10 and 11 |
| `stashdock-plugin-1.0.0-win32-x64.zip` | ChatGPT plugin, with its own Node runtime |
| `stashdock-extension-chrome-1.0.0.zip` | Chrome extension, load unpacked |

The Windows installer is not code-signed yet, so Windows may show a SmartScreen
prompt. macOS packages will follow in a later release.
