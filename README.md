# StashDock

Your context library for any AI. Save links, files, notes, prompts and rules, then
browse your library and use references as context in conversations.

[Website](https://stashdock.app) · [Guide](https://stashdock.app/guide.html) ·
[Downloads](https://github.com/GaryYang12345/StashDock/releases) ·
[Report an issue](https://github.com/GaryYang12345/StashDock/issues)

## Install

Choose StashDock Desktop, the ChatGPT plugin, or both. Add the browser extension
to save pages as you browse. Desktop and the plugin use one library on the same
computer; either can provide the local connection for browser saving.

| Package | Download |
| --- | --- |
| Windows Desktop | [Latest Desktop release](https://github.com/GaryYang12345/StashDock/releases/latest) |
| ChatGPT plugin | [Plugin releases](https://github.com/GaryYang12345/StashDock/releases) |
| Chrome extension | [Chrome extension package](https://github.com/GaryYang12345/StashDock/releases/latest) |

- [Windows installation](docs/INSTALL_WINDOWS.md)
- [ChatGPT plugin installation](docs/windows-plugin-install.md)
- [Browser extension installation](extension/README.md)

The ChatGPT plugin ZIP includes its runtime and native helpers. Download the
complete matching ZIP; GitHub's automatic Source code archives are development
source, not installable plugins. macOS and Claude remain Coming soon.

## Open-source product code

This public repository contains the reviewed product sources, installation
metadata, user documentation, licenses and releases. Website sources, internal
design documents, development instructions and handoffs are maintained privately.
Existing release tags remain historical snapshots of their original versions.

Desktop sources are in `src-tauri`, shared UI in `src`, the ChatGPT plugin in
`plugins/stashdock`, and the browser extension in `extension`.

## License

[MIT](LICENSE). Third-party software keeps its own licenses; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and bundled notices. Platform
marks belong to their respective owners.
