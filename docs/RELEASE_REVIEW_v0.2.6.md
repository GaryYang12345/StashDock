# Windows release verification: v0.2.6

Verified on 2026-10-26. Component versions: Desktop 0.2.6, ChatGPT plugin
0.4.35, Chrome/Edge/Firefox extensions 0.4.16. The exact source commit and
download hashes are recorded in the release's `release.json` and `SHA256SUMS.txt`.

## Completed checks

- Clean `npm ci`, TypeScript, canonical extension asset parity and all 455
  frontend/MCP/website tests passed.
- Windows native tests: 230 passed. One OS-clipboard mutation test remained
  intentionally ignored to preserve the user's clipboard.
- Production Tauri/NSIS, self-contained plugin and all three browser packages
  built successfully. The website production build passed with its existing
  large-chunk warning. SDK debug-symbol and upstream annotation warnings were
  retained, not hidden or patched in third-party source.
- The release guard accepted production and development configurations and
  rejected a release desktop built without embedded frontend assets.
- The installed Desktop reported 0.2.6, loaded `http://tauri.localhost/` with the
  development server stopped, showed its actual library and Settings, and
  minimized to and restored from the floating folder. Its process was owned by
  the Windows shell. Installed icon resources matched the approved artwork.
- A consistent SQLite backup and managed-file copy preceded installation.
  Read-only comparison afterward confirmed that every existing reference ID
  was preserved.
- The plugin ZIP was extracted into a fresh directory. All 168 manifest files
  matched their hashes; bundled Node 24.22.0 and relative stdio startup worked
  with an empty PATH. Native link lookup, link-only PDF lookup and the bundled
  App resource passed.
- Isolated packaged-server checks passed for search/read/save, tag changes,
  retries after restart, context provenance and original file bytes. They wrote
  no references to the real library.
- The local host installed `stashdock@personal` 0.4.35 from the complete package.
  Installed files matched the extracted release. Model/App tool boundaries,
  manual App entrypoints and compact shelf reads passed. A new conversation or
  host restart is needed for an already-running host to start the new server.
- Actual system-renderer and packaged-renderer checks produced screenshots,
  preserved foreground PDF link-only behavior, returned no private/file page
  material and removed temporary profiles. Cancellation terminated the test's
  renderer processes, removed scratch files and allowed a subsequent render.
- Three browser builds use the same canonical reader/UI and keep their native
  manifest/sidebar adapters. Browser capture, target and release-boundary
  regression checks passed. X Article fixtures retain read-only rich text and
  the correct outer-post identity.
- The public-source gate checks the staged index, excludes runtime/data/cache
  files and the separately licensed website TTFs, and found no credential-pattern
  matches. Source, binaries and recoverable local evidence remain separate.

## Verification boundaries

- This was an existing Windows x64 development computer, not a fresh Windows
  installation. WebView2 first-install acceptance still needs a clean device.
- Native browser installation/website-consent/Save gestures were not repeated
  in every browser in this release run. Unpacked installs require Reload;
  Firefox remains a temporary unsigned installation.
- Store approval, Windows code signing, macOS builds and Claude/Safari release
  acceptance are not implied by these checks.

See [release notes](RELEASE_NOTES_v0.2.6.md) and
[Windows installation](INSTALL_WINDOWS.md).
