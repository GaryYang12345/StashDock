# StashDock

**Save once. Use in any agent.**

StashDock is a local-first library of reusable AI context. Collect pages, links,
files, prompts and rules, then browse your library and use references as context
in conversations.

## Download

Get Windows x64 packages from [GitHub Releases](https://github.com/GaryYang12345/StashDock/releases/latest).

| Package | Use |
| --- | --- |
| `StashDock_<version>_x64-setup.exe` | Standalone Windows desktop app |
| `stashdock-plugin-<version>-win32-x64.zip` | ChatGPT/Codex local plugin, including Node runtime and native helpers |
| `stashdock-extension-chrome-<version>.zip` | Chrome extension, manual installation |
| `stashdock-extension-edge-<version>.zip` | Edge extension, manual installation |
| `stashdock-extension-firefox-<version>.zip` | Firefox development extension, temporary installation |

Desktop and the AI plugin work independently. On the same computer they resolve
one local library. The browser extension saves through either running local provider.

Versions come from `package.json` (Desktop), `plugins/stashdock/.codex-plugin/plugin.json`
(AI plugin) and `extension/manifest.json` (browser extension).

- [Windows installation](docs/INSTALL_WINDOWS.md)
- [ChatGPT plugin installation](docs/windows-plugin-install.md)
- [Browser extension installation](extension/README.md)
- [Mac migration handoff / Mac 迁移交接](docs/MAC_START_HERE.zh-CN.md)

The current release is Windows x64 only. macOS, Claude and Safari are not released.
The Windows installer is not code-signed. Browser packages are not store listings;
Firefox needs Mozilla signing for persistent installation. Do not disable OS or
browser security protections to install StashDock.

## What you can do

- Save the current readable page from Chrome, Edge or Firefox, using your normal
  signed-in browser. The extension saves the chosen page, not an entire account.
- Browse visual cards, search, filter by tags, edit metadata and choose covers.
- Keep original files, open them in their normal editor, and transfer their current
  bytes alongside Markdown context through the Windows clipboard or native drag.
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
a file upload. Public URL previews use isolated system WebView2, not browser cookies.

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
Current build scripts target Windows. See the Mac handoff before building on macOS.

## Repository layout

```text
src/                      Shared React UI, context domain and host adapters
src-tauri/                Rust desktop, SQLite, original-file transport and helpers
plugins/stashdock/        MCP server, plugin metadata and user-facing Skill
extension/                Shared Chrome / Edge / Firefox Save-page extension
.agents/skills/arc/       Portable Arc development Skill and original license
scripts/                  Asset generation, builds, packaging and verification
tests/                    Isolated regressions and rendered UI fixtures
docs/                     Architecture, product principles, installation and handoff
docs/history/             Dated design and verification records (not current rules)
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
