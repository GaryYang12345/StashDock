# Release verification

Stage reviews run only when requested by the user (AGENTS.md). Use `snapshot-version.mjs` before cleanup. Retired X sign-in/import tools, connection-runtime downloaders and fixed-canvas rollback commands are no longer active tools; historical documentation is evidence, not a supported workflow. User data and recovery snapshots are not cleanup targets.

Run `npm run test:frontend`, `npx tsc -b`, `npm run desktop:test`, production desktop/plugin builds and `npm run assets:ui:check`.

Current rendered checks (Playwright CLI `run-code --filename`, one script at a time per browser session):

- `build-browser-extensions.mjs`: generate clean Chrome/Edge/Firefox directories from one canonical source after `assets:ui`; only generated target directories are replaced.
- `verify-browser-guides.js`: isolated Desktop Settings fixture on 18749 and MCP harness on 18747, both themes/four widths, Edge/Firefox setup and detected usage guides. Open actions are mocked; never launches a real user application.
- `verify-browser-save-confirm.js`: Save sidebar fixture on 18749; duplicate cancel/Escape/replace, replacement error/retry and navigation invalidation, both themes at 320/390/768/1024/1440. No real library mutations. Provider transactions and bounded acknowledgements have independent JS/native regressions.
- `verify-firefox-runtime.mjs <web-ext-entry>`: actual Firefox in a disposable profile; checks module background startup, session storage and raster encoding. It never grants broad website permissions. Report permission-gated document extraction separately from passed checks. Full native permission/sidebar/read/Save acceptance remains manual.

- `verify-stage-review.js`: production dashboard fixture, save-only sidebar failure/retry/dirty-field behavior and packaged MCP pagination in both themes. Uses isolated servers on 18531/18751; the MCP harness must point to a disposable `mcp-test-` directory. The dashboard fixture composes the real LibraryView instead of duplicating its old layout.
- `verify-add-peer-hover.js`: delayed Add in the isolated MCP harness on 18752, both themes, grid/list and narrow/wide layouts. Checks peers stay hidden until hover and keep their normal color, in-flight presses do not reach transport, and success/reset/removal/repeat preserve the original interaction.
- `verify-import-cover.js`: shared cover picker in the isolated import fixture on 18532. Checks light/dark themes at four widths, delayed lookup, restore/replace/invalid replacement, tab drafts, Note and per-file covers, explicit Save, and the optional capability gate. Native raster validation and file/SQLite persistence have separate Rust tests.
- `verify-edit-cover.js`: shared editor at four widths in both themes, cancellation, save/reopen and default restoration; actual packaged MCP import/edit on 18753 with a disposable library and real image helper. Checks screen-reader status does not become visible copy. Starting on 18753 runs only the MCP cases. Do not rebuild generated HTML while the Vite fixture is running a test; its HTML watcher reloads the page.
- `verify-packaged-cover.mjs`: real packaged, browser-free image preparation, invalid raster rejection, managed image default restoration and original-byte/context preservation in its own temporary SQLite library.
- `verify-original-file-context.js`: isolated MCP Add-to-draft payload includes original-file reading requirements and the user's supplemental context; checks the host capability gate. It does not claim real-host composer receipt or AI comprehension. `tests/file-context.test.mjs` separately checks ID resolution, unchanged bytes, empty overrides, missing files and managed-path escapes.

- `verify-code-audit-0421.js`: standalone dashboard shadow/window states, responsive themes and cross-menu dismissal/reopening.
- `verify-close-focus-0421.js`: immediately opening another menu during dialog exit.
- `verify-import-motion-0420.js`: content-sized import transitions, explicit file save and desktop menu states.
- `verify-mcp-audit-0421.js`: isolated MCP pagination/focus refresh, grid/list sizing, themes and card/tag menus.
- `verify-shared-polish-0420.js`: MCP import, explicit file save, editor/menu transitions and reduced motion.
- `verify-import-polish-0423.js`: fitting Note transition frames, short-screen scrolling, original black/green/black Add feedback, hover visibility, removal then Add and intentional repeats, tag glide/context menu and inline bookmark icons under CSP.
- `verify-bookmark-reader-0423.mjs`: read-only aggregate comparison of actual browser caches and shared packaged native reader.
- `verify-mcp-pdf-lookup.mjs`: actual packaged PDF renderer against the public arXiv regression URL; creates its own test database.
- `verify-installed-mcp-context.mjs`: read-only installed release/protocol/template smoke.
- `verify-library-fingerprint.mjs`: read-only data integrity before/after deployment.
- `verify-lightweight-drag-motion.js`: synchronous bar/card rasters and both themes at four widths. Window switching is immediate, with no custom animation. `verify-desktop-windows.ps1` checks actual visibility, native frame and Z-order; repeated GUI collapse/open checks must include the second and later cycles.
- `verify-file-copy-feedback.js`: isolated desktop IPC fixture for single/bulk file-copy routing, original success feedback and clipboard errors. The separately ignored `copied_markdown_survives_source_thread_and_reads_as_a_real_file` native test requires `STASHDOCK_CLIPBOARD_TEST=1`, writes a generated test Markdown file to the actual OS clipboard and keeps it valid. Do not run it as an unattended background test.

The MCP harness requires a disposable `mcp-test-` directory and `STASHDOCK_PREVIEW_MUTATIONS=1`; never run mutation checks on the user's collection. `seed-audit-fixture-0421.mjs` seeds its dedicated 65-note fixture. Run draft/attachment tests only against the development harness, never the real composer. Inspect screenshots as well as assertions.

Retired browser-shelf acceptance scripts were deleted with their implementation; the pre-cleanup snapshot preserves recovery evidence. Other historical verification documents are not the current release acceptance contract. Add regressions to the active suite above and to `tests/` rather than copying another surface implementation.
