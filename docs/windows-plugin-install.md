# StashDock — ChatGPT local plugin for Windows x64

Download `stashdock-plugin-0.4.35-win32-x64.zip` from
[Releases](https://github.com/GaryYang12345/StashDock/releases/latest) and extract
it to a permanent folder. Keep the hidden `.agents` folder and `plugins` together.
Do not use GitHub's Source code ZIP: it does not contain the required binaries.

In a compatible ChatGPT desktop host, add the extracted directory as a local
plugin marketplace, then install StashDock in the Plugins Directory. If the
compatible Codex CLI is available, the equivalent commands are:

```powershell
codex plugin marketplace add "C:\path\to\extracted-folder"
codex plugin add stashdock@personal
```

Start a new conversation. Ask “Open my StashDock” to browse your library and use
references as context in conversations. Local plugin support and installation UI
are host-owned; this package is not a universal web ChatGPT installation or an
official public-directory listing. See
[OpenAI's local marketplace instructions](https://developers.openai.com/plugins/build/plugins).

No separate Desktop, Node.js or npm installation is needed. Windows previews use
the system Evergreen WebView2 Runtime. If it is missing, install Microsoft's
[Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).

The ZIP contains `RELEASE_MANIFEST.json` with individual file hashes and dependency
licenses under `plugins/stashdock/notices`. It supports Windows x64 only. macOS
needs a separately built and verified package.
