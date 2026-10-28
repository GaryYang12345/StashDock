# StashDock ChatGPT plugin 0.4.38 for Windows

- Fix Native Messaging manifests being registered through a virtualized Windows AppData path. The plugin now owns its registration files beside its native helper and publishes their resolved physical paths to Chrome, Edge and Firefox.
- Keep the existing single-library capture transaction, duplicate confirmation and durable retry receipts.
- Protect the current registration when an older installation is removed.

The plugin continues to include its pinned Node runtime and on-demand Windows helpers. Desktop is optional.
