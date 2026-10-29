# StashDock ChatGPT plugin for Mac

Requires macOS 14 or later on Apple Silicon. The package includes its runtime;
no separate Node.js or StashDock Desktop installation is needed.

## Install

1. Download `stashdock-plugin-1.0.0-darwin-arm64.zip` from
   [Releases](https://github.com/StashDock/StashDock/releases/latest).
2. Extract it to a permanent folder. Keep the hidden `.agents` folder
   and `plugins` directory together.
3. Add the extracted folder as a local plugin marketplace in a compatible
   ChatGPT desktop host and install StashDock. With the compatible Codex CLI:

```sh
codex plugin marketplace add "/path/to/extracted-folder"
codex plugin add stashdock@personal
```

4. Open a new conversation, then open StashDock from the side panel.

For illustrated instructions, see [the setup guide](https://stashdock.app/guide).

## Use your library

Browse and manage references, select them and choose Add to chat.
You can also ask AI to find references, organize tags or save a useful note.
Desktop and the plugin share one local library; install either or both.

Install and open Desktop or the plugin once to set up Chrome page saving.
The Chrome extension can then save pages while both applications are closed.
Browser bookmark import is available directly in StashDock.

## Package information

This package is not Developer ID signed or notarized.
`RELEASE_MANIFEST.json` lists file checksums. Third-party licenses are in
`plugins/stashdock/notices`.
