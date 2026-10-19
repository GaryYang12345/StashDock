# Windows runtime and release packaging

## Runtime ownership

Windows screenshots and public PDF cover rendering use system Evergreen
WebView2, through `preview_webview.rs`. There is no bundled Chromium or discovery
of the user's daily Chrome/Edge executable. One bounded STA thread and hidden
native parent own a private WebView2 controller, random temporary profile and
kill-on-close renderer job (768 MiB). CDP stays inside the WebView2 COM API; no
remote-debugging port is opened. Downloads, permission prompts, host objects,
web messages, popups and saved-password/autofill features are disabled.
Native navigation guards also deny local/non-web schemes. HTTP authentication,
client-certificate and external-application prompts are explicitly cancelled.

The existing public-only proxy still pins public DNS destinations, rejects
private/file URLs and covers redirects/subresources. Rendering never reuses
cookies or reads an authenticated browser profile. Browser extensions remain
the logged-in-page capture path. Node owns helper scratch folders and removes
them after child termination, including cancellation. Native in-process work
retains its own RAII profile cleanup. Force-killing the entire owner process can
still leave temporary disk files; it does not authorize deleting other sessions.

Commands/events use bounded queues (32/256); events cap at 128 KiB and command
responses at 8 MiB. Event overflow fails explicitly,
not by dropping events and later saving an incomplete capture. Renderer failure
may use an available OG cover, labelled `cover`, not claim it is a screenshot.
PDF parser modules are embedded build inputs; no runtime CDN is required.

## Self-contained plugin execution

`scripts/node-runtime-lock.json` pins the unchanged official Windows x64 Node
executable and SHA-256. `prepare-node-runtime.mjs` downloads/verifies it at build
time. `.mcp.json` launches the bundled relative executable, not `node` on PATH.
The runtime and its complete upstream license ship with the plugin. Node is
not installed globally; npm, headers, corepack and node_modules are not shipped.
Do not use executable packers/custom Node builds merely to shrink the archive.

WebView2 is an OS prerequisite, not hidden package bytes. Tauri's desktop
installer handles its WebView2 prerequisite. The independent plugin reports a
missing Runtime and the installation guide links to Microsoft's official
Evergreen download. A fresh Windows installation still needs acceptance; the
development machine's existing Runtime is not proof of that path.

## Reproducible release steps

1. `npm ci` with supported development Node and C++/Rust build tools.
2. `npm run plugin:build` verifies Node, builds native helpers and bundles UI/MCP.
3. `npm run test:frontend`; `npm run desktop:test`.
4. `node scripts/verify-system-renderer.mjs` tests real output, PDF, rejection,
   cancellation and repeated rendering. Network targets must be reachable.
   `node scripts/verify-renderer-cancellation.mjs` additionally observes this
   test's actual WebView2 processes before cancelling, then verifies no owned
   process/profile remains and a subsequent render succeeds.
5. `npm run plugin:package` makes an allowlisted ZIP and per-file hash manifest.
6. `node scripts/verify-plugin-release.mjs <extracted-release-root>` tests
   extraction integrity and actual bundled-runtime stdio without system Node.
7. `npm run desktop:build` creates the production Desktop/NSIS installer without
   Chromium resources. Verify installed native UI with the dev server stopped.

Package cleanup excludes source server modules, retired browser engines,
dependency caches, source maps, personal libraries/profiles and development
build artifacts. The local marketplace descriptor is included for early
installation; public repository/store URLs must be filled with real destinations.
Windows/macOS assets must never be treated as interchangeable.

The ZIP/local marketplace is the complete installable unit. A source-only GitHub
checkout is not an equivalent plugin release: ignored binaries are absent.
GitHub distribution delivers the matching verified Release ZIP before registering
its local marketplace. See [installation](windows-plugin-install.md) and
[release process](RELEASING.md); adding the source repository alone does not fetch
ignored binaries. No unsupported host install hooks are assumed.
