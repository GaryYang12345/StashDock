# Windows screenshot/runtime release verification — 2026-10-19

## Scope

Replace redistributed Chromium with isolated system WebView2 and make the
Windows x64 AI plugin independently runnable with its own verified Node.
Desktop and the plugin keep the same native preview implementation and canonical
SQLite library. Browser extension behavior and approved UI are unchanged.

Recovery snapshot: `artifacts/before-webview-runtime-20261019`. It includes the
previous source, executables/plugin files and a consistent 48-reference database.
Never restore that database over newer user data merely to roll back code.

## Implementation

- One dedicated STA owns the hidden native parent, WebView2 controller, private
  temporary profile and renderer job. No daily browser process/profile is used.
- Renderer job limit: 768 MiB. Commands/events: 32/256 entries, events at most
  128 KiB and responses at most 8 MiB. Overflow fails explicitly. Rendering has
  a bounded deadline; the existing public-only pinned-DNS proxy remains.
- Native callbacks cancel downloads, permission requests, new windows,
  credentials/client certificates and external-application URI launches.
  Navigation permits public HTTP(S) and the renderer's blank/srcdoc pages only.
  Host objects, web messages, password/autofill and DevTools UI are disabled.
- Node owns each helper scratch directory and removes it after child exit,
  including forced cancellation. The kill-on-close job owns only this session's
  WebView2 browser. No renderer debugger websocket is opened.
- Retired browser discovery, runtime integrity loader, Chromium download/prep
  scripts and direct WebSocket dependency were removed from active source.
- The plugin includes unchanged official Node 24.22.0, pinned SHA-256 and its
  complete upstream notices. `.mcp.json` uses its contained executable rather
  than system PATH. npm, headers and node_modules are not shipped.
- Release packaging uses an explicit runtime allowlist, per-file SHA-256 and
  the small schema SQL asset required by the bundled server. Native helpers,
  UI/SDK bundles and licenses remain; source server modules and browser engines
  do not enter the ZIP.

## Acceptance evidence

The first completed package measured 112,034,855 bytes unpacked (106.84 MiB),
42,358,046 bytes zipped (40.40 MiB), compared with the former 296.5 MiB plugin
directory. This is approximately 64% smaller even after adding Node (89.53 MiB).
The final prompt-isolation rebuild is recorded below after its own verification;
do not mistake the first package for that final build.

- Frontend: 339 tests passed and production UI build passed.
- Initial native round: 144 passed, one existing system-clipboard test ignored.
- Real screenshot assertions require `previewKind: screenshot`; an OG cover
  fallback is not accepted as screenshot success. Example.org and rust-lang.org
  screenshots were inspected; the real arXiv PDF yielded its first-page cover,
  correct Darwin Gödel Machine title and the existing bounded text projection.
- Repeated captures, private/file URL rejection, cancellation and zero new
  leftover profiles passed, including against the extracted release helper.
- Cancellation while the renderer was active observed six test-owned WebView2
  processes (sampled summed working set 334 MiB), then zero remaining processes,
  removed scratch directory and a successful subsequent PDF render. Summed
  working set is not a measurement of unique physical memory or a worst case.
- Actual extracted ZIP: 114 files verified; with PATH empty its relative bundled
  Node command started MCP, listed tools/read the embedded UI, opened an isolated
  empty library, read a public webpage and rendered the real PDF. The same smoke
  check passed using the deployed cache, without writing to the real library.
- Desktop production executable opened `http://tauri.localhost/`, displayed 48
  references and read the same PDF in its actual Import form. The draft was
  closed without saving. No development server was needed.
- Reference comparison against the recovery snapshot: all fields remained
  identical except three `origin.faviconUrl` enrichments by the normal worker.
  Title, content, tags, preview, IDs, file metadata and reference count matched.

Raw evidence is under `output/system-webview-*.log` and
`output/system-renderer/`. Reusable checks are `verify-system-renderer.mjs`,
`verify-renderer-cancellation.mjs` and `verify-plugin-release.mjs`.

## Release boundaries

This proves the tested Windows machine, not every clean installation. Fresh
Windows 10/11 prerequisite installation, signing/SmartScreen, offline/network
failure acceptance and broader machine/DPI coverage remain release work.
WebView2 is a shared OS prerequisite, not zero disk usage; the plugin installer
guide points to Microsoft's Evergreen Runtime when absent. macOS is not built
or validated by this change.

Legacy generated Chromium folders on this developer machine/cache remain:
their cleanup was blocked by execution policy. Active new code and the release
allowlist do not depend on or redistribute them. Keep current-host reload and
later explicit cleanup separate; do not bypass the policy or delete profiles.
Existing host conversations may retain the old server; start a new conversation
to load the updated plugin runtime.

GitHub publication is not performed. The complete ZIP/local marketplace, not a
source-only checkout with ignored binaries, is the tested installable unit.
See `windows-runtime-release.md` for the build/distribution contract.

## Primary references

- [Node official release checksums](https://nodejs.org/dist/v24.22.0/SHASUMS256.txt)
- [OpenAI desktop-only plugin packaging](https://developers.openai.com/plugins/deploy/desktop-only)
- [WebView2 basic authentication behavior](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/basic-authentication)
- [WebView2 external URI event](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.launchingexternalurischeme)

## Final prompt-isolation rebuild

Completed and verified against the final extracted ZIP, not the earlier package.

| Artifact | Final size | SHA-256 |
| --- | ---: | --- |
| Plugin ZIP `output/releases/stashdock-plugin-0.4.27-win32-x64.zip` | 42,286,744 bytes (40.33 MiB) | `effaf7531b013207c9c967ef7e56087da55fbf604607497daaabf81c418c56cc` |
| Plugin unpacked | 111,112,574 bytes (105.97 MiB) | Per-file manifest: 114 files |
| Desktop NSIS installer | 15,696,313 bytes (14.97 MiB) | `25736170dfba8618cbb325c65da3387bf32c9bc0e140c3e63a2b8662cc7d24eb` |
| Desktop executable | 25,275,392 bytes | `f38c629539cdd0aef4c536436b1d711538bdd61d8448380e5771d0c5ca5057bb` |

The plugin's unpacked runtime is about 64% smaller than the former 296.5 MiB
directory, while now including 89.53 MiB of official Node. The MCP server is
minified with function names retained. No custom Node build or executable packer
is used. These sizes describe the clean release, not the developer cache that
still contains the policy-blocked legacy engine.

- Final frontend suite: 339 passed; production UI/plugin build succeeded.
- Final native suite: 146 passed, one existing system-clipboard test ignored.
  An initial run exposed a private-IP navigation regression, fixed before the
  final build. That run also had one temporary-fixture `Access denied` during
  library anchor replacement; the complete independent retry passed without
  changing permissions or weakening the anchor mechanism.
- Final extracted artifact and installed plugin each passed the bundled Node
  relative-command check with PATH empty: tool discovery, embedded UI, isolated
  empty library, actual webpage lookup and PDF cover generation.
- Final extracted helper produced real Example.org and Rust screenshots, an
  arXiv PDF cover, and a repeated screenshot; private/file URLs were rejected.
  All image checks required screenshot output rather than an OG fallback.
- Active cancellation observed six owned renderer processes (sampled summed
  working set 335 MiB), followed by zero remaining processes, removal of its
  scratch directory and a successful subsequent PDF capture. This is one sample,
  not a maximum memory claim or unique-RAM measurement.
- The installed Desktop executable's hash matches the final artifact. Its
  production window loads `http://tauri.localhost/` and the existing collection.
  Its actual Import form also populated the arXiv PDF title and body; the
  verification draft was closed without saving.
  Plugin cache deployment verified all 111 plugin files against the extracted
  release; unchanged in-use runtime files were not overwritten.
- Final read-only comparison: 48 references; every row field matches the
  recovery snapshot except the same three normal favicon enrichments. No test
  reference was saved into the user's library.

Final evidence: `output/system-webview-final-release-verification.log`,
`output/system-webview-final-installed-plugin.log`,
`output/system-webview-final-renderer.log`,
`output/system-webview-final-cancellation.log`,
`output/system-webview-final-frontend.log`,
`output/system-webview-hardened-tests-retry.log` and
`output/system-renderer/`. The release boundaries above still apply.
