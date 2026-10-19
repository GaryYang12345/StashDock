# Install StashDock on Windows

Download packages from [Releases](https://github.com/GaryYang12345/StashDock/releases/latest).
This release supports Windows x64. Choose Desktop, the ChatGPT local plugin,
or both; both use the same local library.

## Desktop

Run `StashDock_0.2.5_x64-setup.exe`. The installer handles the system WebView2
prerequisite. This first release is unsigned, so Windows may show an unknown
publisher warning. Verify the source and checksum; do not disable SmartScreen.

The panel opens on first launch. With Floating window enabled, minimize returns
to the folder. Turn it off in Settings for normal taskbar minimization.

## ChatGPT plugin

Follow [the local plugin guide](windows-plugin-install.md). Download the complete
plugin ZIP, not GitHub's automatic Source code ZIP. You do not need to install
StashDock Desktop, Node.js or npm separately.

## Browser extension

Download the matching browser ZIP and extract it to a permanent folder:

- Chrome: `chrome://extensions` → Developer mode → Load unpacked → extracted folder.
- Edge: `edge://extensions` → Developer mode → Load unpacked → extracted folder.
- Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
  select `manifest.json` in the extracted folder. This development installation
  ends when Firefox restarts. A signed permanent package is not yet published.

Open Desktop or the AI plugin, click the extension toolbar icon on a normal
webpage and approve website access in the browser prompt. The sidebar refreshes
with the active page and stays open after Save. See [extension documentation](../extension/README.md).

## Checksums and data

Each Release includes `SHA256SUMS.txt`. For example:

```powershell
Get-FileHash .\StashDock_0.2.5_x64-setup.exe -Algorithm SHA256
```

Compare with that file. Plugin packages include a per-file `RELEASE_MANIFEST.json`.
Checksums establish integrity, not publisher identity or a code signature.

Manage the local library location in Settings. Different computers do not sync
automatically. Never delete the shared library to reinstall an app or extension.
