# Install StashDock on Windows

Download packages from [stashdock.app](https://stashdock.app/guide) or [Releases](https://github.com/StashDock/StashDock/releases/latest).
This release supports Windows x64. Choose Desktop, the ChatGPT local plugin,
or both; both use the same local library.

## Desktop

Run `StashDock_<version>_x64-setup.exe`. The installer handles the system WebView2
prerequisite. This release is unsigned, so Windows may show an unknown
publisher warning. Verify the source and checksum; do not disable SmartScreen.

The panel opens on first launch. With Floating window enabled, minimize returns
to the folder. Turn it off in Settings for normal taskbar minimization.

## ChatGPT plugin

Follow [the local plugin guide](windows-plugin-install.md). Download the complete
plugin ZIP, not GitHub's automatic Source code ZIP. You do not need to install
StashDock Desktop, Node.js or npm separately.

## Browser extension

Download the Chrome extension ZIP and extract it to a permanent folder:

- Chrome: `chrome://extensions` → Developer mode → Load unpacked → extracted folder.

Install and open Desktop or the AI plugin once, then click the extension toolbar icon on a normal
webpage and approve website access in the browser prompt. The sidebar refreshes
with the active page and stays open after Save. Both applications may be closed
after setup. See [extension documentation](../extension/README.md).

## Checksums and data

Each Release includes `SHA256SUMS.txt`. For example:

```powershell
Get-FileHash .\StashDock_1.0.0_x64-setup.exe -Algorithm SHA256
```

Compare with that file. Plugin packages include a per-file `RELEASE_MANIFEST.json`.
Checksums establish integrity, not publisher identity or a code signature.

Manage the local library location in Settings. Different computers do not sync
automatically. Never delete the shared library to reinstall an app or extension.
