# StashDock

**Save once. Use in any agent.**

StashDock is a local-first library of reusable AI context. Collect pages, links,
files, prompts and rules, then browse your library and use references as context
in conversations.

## Download

Download from [stashdock.app](https://stashdock.app) and follow the
[setup guide](https://stashdock.app/guide). Packages for Windows x64 and macOS
(Apple silicon) are also on [GitHub Releases](https://github.com/GaryYang12345/StashDock/releases/latest).

| Package | Use |
| --- | --- |
| `StashDock_<version>_x64-setup.exe` | Standalone desktop app for Windows 10 and 11 |
| `StashDock_<version>_aarch64.dmg` | Standalone desktop app for macOS 14 or later, Apple silicon |
| `stashdock-plugin-<version>-win32-x64.zip` | ChatGPT/Codex local plugin for Windows, including Node runtime and native helpers |
| `stashdock-plugin-<version>-darwin-arm64.zip` | ChatGPT/Codex local plugin for Mac, including Node runtime and native helpers |
| `stashdock-extension-chrome-<version>.zip` | Chrome extension for both systems, manual installation |

Desktop and the AI plugin work independently. On the same computer they resolve
one local library. Once Desktop or the AI plugin is installed and configured,
the Chrome extension can save pages while both applications are closed.

Versions come from `package.json` (Desktop), `plugins/stashdock/.codex-plugin/plugin.json`
(AI plugin) and `extension/manifest.json` (browser extension).

- [Setup guide](https://stashdock.app/guide)
- [Windows installation](docs/INSTALL_WINDOWS.md)
- [ChatGPT plugin installation](docs/windows-plugin-install.md)
- [Browser extension installation](extension/README.md)

StashDock 1.0 is released for Windows x64 and macOS on Apple silicon. Neither
installer is signed by a registered developer yet; the Mac app is not notarized.
Windows may show a SmartScreen prompt. On Mac, if the first launch is blocked,
open System Settings → Privacy & Security and click Open Anyway.
Do not disable OS or browser security protections to install StashDock.

## What you can do

- Save the current readable page with the Chrome extension, using your normal
  browser login.
- Import bookmarks from Chrome, Edge, Firefox or Safari without an extension.
- Browse visual cards, search, filter by tags, edit metadata and choose covers.
- Keep original files, open them in their normal editor, and transfer their current
  bytes alongside Markdown context through the system clipboard or native drag.
- Use the ChatGPT panel to manage references and add context to a conversation.
- Ask AI to recommend saved references, use a tag as a context group, save a useful
  note/link, or preview and apply a tag organization plan with your approval.
- On Desktop, minimize the library to a small floating folder. Hover it to search
  and copy or drag references without opening the library; click it to open the
  library, which grows out of the folder.
- Choose English/简体中文, light/dark/system appearance, and a shared storage location.
  Desktop also has a tray, launch at login and a global shortcut.

File understanding belongs to the receiving AI. The plugin's Skill instructs it to
resolve and read selected originals rather than treat a path as file contents.
Native composer attachment support depends on the host; MCP context is not itself
a file upload. Public URL previews use an isolated system renderer (WebView2 on Windows,
WebKit on Mac), not browser cookies.

## Develop on Windows

Requirements: Node.js 24, npm, Rust stable MSVC, Visual Studio C++ Build Tools,
Windows SDK, and the system Evergreen WebView2 Runtime.

```powershell
git clone https://github.com/GaryYang12345/StashDock.git
cd StashDock
npm ci
npm run desktop:dev
```

```powershell
npm run test:frontend
npm run desktop:test
npm run desktop:build
npm run plugin:build
npm run plugin:package
npm run extension:build
```

The installer is generated under `src-tauri/target/release/bundle/nsis`; the plugin
ZIP under `output/releases`; browser directories under `output/extensions`.
Source checkouts do not include native plugin binaries. Build the plugin before
registering a development checkout, or use the complete Release ZIP. Adding the
source repository as a marketplace alone does not download those binaries.

`npm run dev` opens the browser UI workbench; it is not the installed desktop app.
The original `desktop:*` scripts target Windows.

## Repository layout

```text
src/                      Shared React UI, context domain and host adapters
src-tauri/                Rust desktop, SQLite, original-file transport and helpers
plugins/stashdock/        MCP server, plugin metadata and user-facing Skill
extension/                Chrome Save-page extension
.agents/plugins/          Plugin marketplace metadata
scripts/                  Asset generation, builds, packaging and verification
tests/                    Isolated regressions and rendered UI fixtures
docs/                     Installation and release documentation
```

One repository owns shared behavior and platform adapters. Release assets carry
platform-specific binaries; generated runtimes, personal data, profiles,
screenshots and recovery packages do not belong in Git.

Read [AGENTS.md](AGENTS.md) before changes, then [design overview](design.md),
[architecture](docs/architecture.md), [product surfaces](docs/product-surfaces.md),
[window lifecycle](docs/WINDOW_LIFECYCLE.md), [product principles](docs/product-principles.md)
and [release process](docs/RELEASING.md). Dated reports in [docs/history](docs/history/README.md)
describe their own baseline, not the current product. Broad stage reviews run
only when requested.

## License

[MIT](LICENSE). Third-party software retains its own licenses; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and bundled notices. Platform marks
are their owners' trademarks and do not imply endorsement.
