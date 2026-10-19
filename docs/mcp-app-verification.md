# StashDock MCP App

## Independent library and management update (0.4.3, 2026-10-10)

This section describes the current release. Sections below are historical
verification records; their desktop dependency, read-only App, single-column
layout and older version numbers no longer describe the current implementation.
See [product surfaces](product-surfaces.md) for the current architecture.

- The plugin opens the shared SQLite database directly using built-in Node SQLite
  (Node >=22.13); the desktop process and port 17863 are not required. Windows
  startup also recovers the existing user environment data-directory override
  when a running host inherited stale settings. No data migration or merging.
- A restricted MCP-owned bridge on 17864 lets the browser synchronize without
  the desktop. Browser captures and deletions are durable offline; synchronization
  happens on opening/refocusing/retrying when a local service is available.
- App-only management tools support imports, managed file copies, favorites,
  confirmed deletion, tag assignment and global tag rename/removal. Model-facing
  retrieval tools remain read-only. The visible-draft contract is unchanged.
- Arc DropdownMenu and shared Dialog/Button/SearchField/ScrollArea/Alert controls
  compose tag management and import. Approved dashboard card styling remains;
  no second card design system. Two card columns at container widths >=600px,
  one below. Desktop Tags are initially collapsed; small Dock URLs have a visit
  action. Disclosure and dialog motion honor reduced motion.
- Type check, **132/132 frontend tests**, **32/32 native tests**, extension asset
  parity, Windows release build and brand-icon checks passed. No lint script is
  configured. Optional Windows debug PDB linker warnings did not fail the build.
- Own browser harness checks covered 320/390/600/768/1024/1440 widths, light/dark,
  import, favorite hover release, tag assign/filter/rename/remove, delete cancel
  and confirm, responsive cards, selection footer, button width motion, search
  focus, desktop disclosure and URL visit, and browser offline capture/reload/
  sync/delete. These are isolated test contexts, not the real Codex composer.
  No live screen-reader or native screen automation was available.
- Installed plugin 0.4.3 through the official CLI. With the desktop stopped and
  the child process's STASHDOCK_DATA_DIR deliberately absent, the installed
  plugin read all **29 real references**, its headless browser bridge returned
  the same count, and the canonical record signature remained unchanged.
  Consistent backup: `artifacts/library-before-independent-20261010.sqlite3`.
- Resource: `ui://stashdock/shelf-v5.html`. Source and installed UI SHA256:
  `633B7DACD5BAA0B890682D8B3F4A1AC30D67A8453A38678CD35DD08BC3A2D2C1`.
  Portable bundle SHA256:
  `F03509C060E08CEFFECDC0339C53D2236B8886CFDD25A212CD8528C275171B6E`.
  Self-contained UI: 1,263,393 bytes.
- Updated and restarted `D:/StashDock/stashdock.exe`; root and release EXE SHA256:
  `1FE8CA5963819B6C0CC6CD43873E9212D0BA64CECAF55CB9332B0644BC4105F2`.
  Previous EXE: `artifacts/stashdock-before-independent-20261010.exe`.
- One stale StashDock MCP server was still serving an empty default library due
  to its old inherited environment. Only that verified StashDock server process
  was ended; Codex was not terminated. Restart Codex/reopen the App to discover
  new tools and release. Reload Chrome extension 0.2.0 for its storage permission.
  Real host presentation of this release still needs human acceptance.

## Surface consistency update (0.3.3, 2026-10-10)

- MCP uses dashboard's shared preview renderer/card CSS in one vertical column: screenshot zoom, selection circle, favicon/source and external-link action. Add to chat remains the distinct action. This read-only adapter does not falsely offer mutation or native drag controls.
- Application and MCP import the same `src/styles/product-tokens.css`. Search pointer focus uses the subdued gray border rather than foreground black. Arc vendor components remain unchanged.
- Selection bar inherits native compact padding (12px) and Clear precedes Add. Removing the fixed button width restores Arc's natural width spring from Add to chat to Added. Check/text and green acknowledge success; repeat Add remains possible.
- Dashboard Copy and MCP Add hide outside fine-pointer hover, preserving keyboard/coarse-pointer access. Pointer focus and success do not pin actions. Small Dock hover no longer strengthens the border and shares dashboard's subtle screenshot zoom.
- Tray actions are Open StashDock and Quit StashDock; close still hides and Quit alone exits.
- Published resource attachment schemas have no field to rename host-localized generic Context/Data labels. Existing attachment filenames use the saved title or StashDock references. No host-label rename is claimed, user-saved content is not translated and private host code is not patched.
- Type check, 120 frontend tests, 32 native tests and extension asset parity passed. Own MCP harness verified 320/390/768/1024/1440 in light/dark: no horizontal overflow, about 12.67px summary inset including border, correct action order, hover reveal/hide, unchanged test draft and intermediate button widths settling at about 93.33px for Added. This is not Codex's composer.
- Isolated browser contexts against the built desktop assets also verified small Dock and dashboard Copy visibility before/after hover, pointer-focus release after success, stable card borders and unchanged title dimensions/local position during Copy to Copied. Test data/clipboard were synthetic; no user-library writes. A below-fold action can legitimately scroll the viewport, so the regression compares local card coordinates rather than absolute screen position.
- Installed 0.3.3 through the official plugin CLI, resource URI `ui://stashdock/shelf-v4.html`. Source/installed HTML SHA256: `6528377314561BF626FD8425FD5645771D485BCFFEA363A4E400E20889517F60`.
- Rebuilt/restarted only the verified `D:/StashDock/stashdock.exe`. EXE SHA256: `B59580CE7545B07C58A5AF366F5145E6E16FACC8CE01AAE15E9F6C9BBC7091B8`. Previous EXE kept at `artifacts/stashdock-before-consistency-20261010.exe`; saved data untouched. Release/icon checks succeeded, with optional debug PDB linker warnings.
- Arc review: existing Button/SearchField/SegmentedControl/ScrollArea/Alert/EmptyState; semantic tokens, approved radii/spacing, stable animation nodes, accessible names and in-place status. Compact density/hover lift intentionally preserve user-approved styling. Reduced-motion branches are present. No live screen reader or native screen automation was available; those checks remain unverified. The repo has no lint command.

## Scope

The plugin registers an MCP App resource (`text/html;profile=mcp-app`), an `open_stashdock` render tool, and a thread entrypoint. The verified standalone Windows file drag is unchanged. Plugin version: 0.3.2. Browser and MCP shelves share the filter definitions, thumbnail component, SiteIdentity, header/card CSS, and compact context-bar styles; their transport and main action remain separate.

The frontend reuses the existing Arc Button, SearchField, SegmentedControl, ScrollArea, Alert, EmptyState, Skeleton, brand lockup and approved compact Dock card styles. No new design system or third-party card redesign is introduced. The MCP App is a separate host adapter, not another owner of the native library store. Read-only data access uses the existing desktop loopback bridge, through the plugin server.

## Draft contract

1. A user clicks a reference's Add button or selects references and clicks Add to chat.
2. `prepare_stashdock_attachment` rereads the selected IDs from the canonical saved library. It generates one immutable Markdown resource containing the saved body, URL, source, tags and local file metadata. Text is not silently truncated. Missing references and payloads over 2 MB fail explicitly.
3. The app calls the standard MCP Apps `ui/message` bridge with only embedded `resource` content and `_meta["openai/message"] = {target:"active", send:false}`.
4. No top-level text block, follow-up turn, clipboard paste, hidden model-context update, private host IPC, or input automation is used. The host owns the actual draft attachment UI and removal.

Important compatibility limitation: the published OpenAI extension SDK 0.1.0 types only expose `send:true`. The currently installed desktop host additionally advertises and implements the experimental `openai/message.draft` extension. StashDock sends `send:false` only when that specific draft capability is advertised. The compatibility code is isolated in `src/features/mcp-app/draft.ts`. In hosts without that capability the buttons are disabled and an explanation is shown. Never remove this guard or fall back to sending a message.

An acknowledgement means the host accepted the bridge request. It does not prove that a visible chip was rendered in the real composer. Feedback is temporary, not a permanent "attached" state; users can re-add after removal. Timeouts/rejections show an error and instruct the user to inspect the input before retrying. No automatic retry can create duplicates.

## Build and tests

- `npm run plugin:build`: self-contained iframe HTML and a portable SDK stdio server. The installed plugin needs Node 22+ but no node_modules, dev server, localhost iframe, or external assets.
- `npm run test:frontend`: regressions plus SDK resource/tool registration, actual SDK transport preserving draft metadata, full-body snapshot, malformed content, offline desktop, absent draft support, rejected host requests, and portable stdio startup.
- `npx tsc -b`: frontend type check. The repo does not configure a lint script.
- `npm run plugin:preview`: explicit development harness at `http://127.0.0.1:18747`. Its test draft is NOT the Codex composer. It forwards only read-only shelf/preparation tools to the actual local library and records draft requests for verification.

Screenshots remain embedded raster images. The resource read declares exact public origins from saved website/favicon metadata, permitting the shared SiteIdentity's original-site image fallbacks. Connect domains remain empty; no third-party favicon proxy, wildcard CSP, server-side remote image fetch, or privileged/local image URL is introduced. Newly saved origins require reopening the App to refresh the host's resource CSP. Invalid or unavailable site images fall back to the same initial as the browser shelf. A site certificate failure is not bypassed.

## Actual host acceptance

The user reported the MCP App working on 2026-10-09 ("可以了") before requesting visual parity. This confirms user-reported basic host operation, not every removal, batch or post-send content scenario below. The updated 0.3.1 presentation and host icon still need human visual acceptance after plugin reload.

After updating the local plugin, restart Codex so the new MCP tools/resource/entrypoint are discovered. Do not terminate Codex from a script.

1. Open StashDock through the MCP App entrypoint or `open_stashdock`, NOT the legacy `/dock?surface=codex` browser tab.
2. Type a short draft first. Click a single reference's Add button.
3. Confirm a visible, removable reference appears in the actual input box, the existing draft is unchanged, and no turn begins.
4. Remove it from the input box, then add it again.
5. Select two references and use Add to chat. Confirm a batch resource appears and can be removed.
6. Manually send a question about those references. Confirm the saved body is available without pasting text or IDs.

This last step is human acceptance, not an automated Codex/ChatGPT UI test. Passing the development harness is not a substitute. If the host does not discover local MCP Apps or does not advertise draft support, report the exact limitation rather than displaying a false Added state.

## Verification record (2026-10-09)

- Type check passed. Frontend suite: 113/113 passed. Extension asset parity passed.
- Real SDK transport test preserved `_meta` with `send:false`, and contained resource blocks only. This is a protocol test, not a real composer test.
- The development harness loaded actual saved screenshots and verified single and two-reference batch requests, unchanged draft text, missing-capability disablement (zero message requests), and host rejection (zero attachment chips).
- Arc review: existing components and semantic tokens; one primary selection action; 4px layout rhythm; keyboard Space selected a reference; pending/success/error/empty/loading states; reduced-motion branch supplied by Arc and shared Dock styles; light/neutral and dark/blue checked; widths 390/768/1024/1440 had no horizontal page or button overflow. A live screen-reader session was not available; semantics were reviewed in code and the browser accessibility snapshot.
- Optimized the self-contained UI to 1,099,163 bytes by embedding only the normal font faces used here. No polling, remote website requests, native drag calls, or user library writes.
- Installed through `codex plugin add stashdock@personal --json`, yielding `C:/Users/86137/.codex/plugins/cache/personal/stashdock/0.3.0`. Its cached stdio server was independently initialized and served all six tools and the correct UI MIME type. Installed and source HTML hashes match: `678BA72C133468DEC96174A1D4C70905C1FE8A60E4BC9FDB47C774F4EC41E4CF`.
- Previous installed plugin backed up at `D:/StashDock/artifacts/stashdock-plugin-before-mcp-app-20261009`. No material files were deleted.
- Original bundled dependency licenses and their inventory are included under the plugin's `notices/`. A subsequent same-version CLI reinstall could not rename the active cache directory on Windows, so only the newly generated notice directory was copied to the installed plugin. Executable/UI hashes were already identical; no running host process was terminated.
- Standalone EXE unchanged: SHA256 `CC3F710024A9D53087DCA3326FDA7658045C2A0E19EE5EB2652E3FB805548D77`.
- At the time of the initial 0.3.0 record, actual host acceptance was pending. The user subsequently reported basic MCP App operation working; detailed attachment removal and saved-body availability after a human sends a turn are not independently verified.

## Visual parity update (0.3.1, 2026-10-09)

- Official plugin presentation fields `interface.composerIcon` and `interface.logo` point to the unchanged supplied brand PNG. MCP server initialization also advertises that PNG as an icon. No private Codex UI modifications.
- Five filters match the browser shelf: All, Recent (7 days), Web, Files, Favorites. Filtering precedes pagination. Refresh is beside the filter row. Thumbnail kinds, favicon loading/fallbacks, search shortcut, selection circles and hover actions reuse the approved presentation.
- Add is the intentionally different action: resource attachment instead of clipboard/drag. It uses the same compact primary-button tokens and green success feedback as CopyForAI. Selection remains after success, so the batch action can show Added and can be explicitly repeated or cleared. A reserved action column prevents card-title reflow.
- The context bar appears only with a selection, uses the existing floating compact-bar shell, and measures about 53px tall in the desktop harness. It has selected count, Add to chat and Clear; no empty explanatory footer or misleading drag handle.
- Type check and 115 frontend tests passed. Own-browser harness verified an unchanged draft and resource-only `send:false` request, green Added feedback, repeat add, clearing the selection/bar, keyboard Space selection, reduced motion, light/neutral and dark/blue. Widths 320/390/768/1024/1440 had no horizontal overflow. These harness actions did not manipulate the actual Codex composer. Live screen-reader verification was unavailable.
- Known original-site image failure in the test environment: `amicro.vercel.app` certificate mismatch. It correctly uses its fallback; no TLS bypass. Other visible saved-site favicons loaded.
- Installed through `codex plugin add stashdock@personal --json` into `C:/Users/86137/.codex/plugins/cache/personal/stashdock/0.3.1`. Installed/source HTML SHA256: `6D34490A5A85EA4A1AFCE4C7C4BB8A7CAD02E0BDE9AB6DB1EC2F5A192D80D034`; brand PNG hashes match. App URI bumped to `ui://stashdock/shelf-v2.html` to avoid reuse of the prior template. No native executable or user data was replaced, and Codex was not terminated.

## Full-height panel update (0.3.2, 2026-10-09)

- Removed the 720px height cap and 320px minimum from the App. The root fills the host iframe viewport (`100dvh`); the existing Arc ScrollArea fills the remaining height below the header. Unselected content has only its normal 12px bottom gutter. Extra clearance is reserved only while the selection bar exists.
- Disabled inline `autoResize`: a fullscreen panel's viewport is host-owned, so reporting that viewport back as content height is inappropriate and can introduce resize feedback.
- The existing thread entrypoint is retained. Tool metadata now declares `preferredModelDisplayMode: fullscreen`; resource metadata declares `preferredDisplayMode: fullscreen` and `availableDisplayModes: [fullscreen]`; App initialization advertises the same modes. If the host nevertheless initializes inline and advertises fullscreen, the App requests fullscreen through the standard public bridge. No Codex private IPC or UI injection.
- Own-browser harness confirmed viewport/root heights match at 500/1000/1100/1600px outer heights, the References scroll viewport extends to the App bottom (rounding error under 1px), and scrolling reaches the final cards. It also observed the standard fullscreen request from an inline initialization fixture. This is not a real-host routing acceptance test: the actual side-panel presentation must be checked after plugin reload.
- Type check and 116 frontend tests passed. Installed 0.3.2 through the official plugin CLI; resource URI is `ui://stashdock/shelf-v3.html`. Native EXE and saved library are untouched. The unavailable live screen-reader check and original-site favicon failures remain as recorded above.
