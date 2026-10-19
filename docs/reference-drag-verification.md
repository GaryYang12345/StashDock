# Reference dragging and refresh feedback

Latest follow-up: see "Browser-owned drag correction" below. The earlier
deployments and test counts in the first sections are historical.

2026-10-09. Scope: preserve the approved Arc cards, improve external dragging,
and separate the embedded shelf's refresh failure from saved cards.

## Correction after user verification

The earlier deployed canvas preview was invisible in the actual host, and the
Codex composer still rejected reference drops. The browser-only text drop tests
below did not establish either native ghost visibility or Codex compatibility.
They are retained as historical results, not as a successful host verification.

The follow-up connects and lays out the HTML drag preview before snapshotting it,
and includes the saved screenshot/title rather than a text-only rectangle.
The earlier native-broker build used a separate, user-initiated Windows file broker:
one card or the whole selection is exported from authoritative SQLite content
as a recognizable `.md` file, then transferred by `drag` 2.1.1 with the preview
bitmap. It never mutates the collection, simulates a paste or submits a message.

Follow-up checks:

- TypeScript compilation; 104 frontend tests; 28 native tests.
- Browser text drags: three trusted gestures, connected/visible 320x112 previews,
  full context, cleanup, right-aligned retry and 16px alert separation.
- Native handoff fixture: three trusted gestures; single and batch IDs; PNG
  dimensions; cancellation cleanup; visible recovery after a failed broker call.
  The endpoint in that fixture is mocked, not the real Windows drag loop.
- Compact Copy/Copied text geometry is stable at 320/390/600; touch checks pass.
- Full card regression passes at 320/390/768/1024/1440, including circular
  controls, favorite hover cleanup, keyboard, touch and dark-blue/reduced motion.
  The headed fixture must be foreground before testing mouse hover; the first
  run without `bringToFront` failed that check, while the corrected run passes.
- Shared-shelf regression passes: one selection/search/filter state across
  native forms, refresh preserving selection, stable source DOM and copy states.
- Security tests reject external/extension/missing origins, arbitrary paths,
  duplicate or oversized ID selections and oversized raster headers.
- Real native ghost visibility, dragging outside the panel and the Codex
  composer's receipt still require a human check after deploying this build.

Arc review: approved components and card layout retained; preview uses semantic
tokens, existing font sizes and weights, no interactive controls or repeated
motion. Existing reduced-motion behavior and Copy keyboard alternative remain.
No Arc Pro component, new design system or vendor-source modification introduced.

Follow-up deployment:

- Built and replaced `D:/StashDock/stashdock.exe`, retaining
  `artifacts/stashdock-before-native-reference-drag-20261009-1414.exe`.
- Root, release and `artifacts/stashdock-native-reference-drag.exe` match SHA256
  `3251A312C609713F8330B46194E8B4E79AA322808E53D71D786C86E95EC9E5D8`.
- Installer: `artifacts/StashDock_0.2.1_native-reference-drag_x64-setup.exe`.
- Running PID 41128; loopback health succeeds; frontend `index-CdJ70a8z.js`;
  native capability is present; external Origin returns403 and invalid token400.
  A request with no valid preview cannot begin a native gesture.
- Read-only native probe still reports COMPLEXREGION3 with a160x160 folder
  region inside the2360x1520 native canvas. No new topmost overlay window.
- All nine branded executable icon sizes match.
- The earlier in-app browser tab was no longer present. Opened the deployed
  `/dock?surface=codex` route again and confirmed saved cards render with no
  connection error. Kept it as a handoff for the human drag check.

## Earlier changes (historical)

- The existing Arc Alert and secondary Button now compose a valid phrasing-content
  retry row, aligned right, with 16px separation below the alert.
- Card screenshots and favicons ignore pointer targeting. Codex's installed
  browser preload inspects the trusted drag event's image path, even if the
  image itself has `draggable=false`. Dragging a card must not activate that path.
- Dock cards, Library cards, and the selection bar use one transfer implementation.
  Plain text and Markdown agree; escaped HTML supports rich-text editors; URI
  lists remain available. No private host IPC or automatic conversation submission.
- Native HTML dragging is retained for external applications. A 300x96 canvas
  preview replaces the full-card ghost and displays the selection count for batches.
  Its background is opaque, but Windows/Chromium may still apply native transparency.
- A small hover lift and shadow indicate draggability without introducing grips
  on cards or reordering. Drag end/drop/page exit clean up transient state; reduced
  motion removes spatial movement. No per-frame React updates or network requests.

## Earlier verified checks (historical)

- TypeScript compilation and 101 frontend tests.
- Three trusted browser mouse drags: screenshot to a contenteditable input,
  selected card to input, and selected-reference bar to input. Each inserts
  complete context, not just the screenshot/URL. No image in the drag event path.
- Preview pixel alpha 255, correct dimensions, drag state cleared after drops.
- Refresh alert/card gap 16px, right-aligned retry, no overflow at 320px.
- Compact Copy/Copied title geometry stable at 320/390/600px; touch targets 44px.
- Shared shelf and card regressions pass: shared selection/search/filter, copy
  failure/success, favorites hover cleanup, 320 to 1440px, light/dark and touch.

## Earlier deployment (historical)

- Build succeeded, including all nine branded Windows icon sizes.
- Root executable, release executable and archived build share SHA256
  `773D8CE479174C20759E6CFA9F67D01C52F76C0CE3B19CF58F2FAA139E6F1A1D`.
- Previous executable preserved as
  `artifacts/stashdock-before-reference-drag-20261009-132655.exe`.
- Restarted `D:/StashDock/stashdock.exe`; loopback health is ready and serves
  `index-Nn8Pf1m6.js`. Existing Codex browser shelf reloaded successfully.
- Read-only native probe: COMPLEXREGION (3), 160x160 visible folder region;
  the large transparent canvas remains excluded from occlusion.

## Not yet verified

The real Codex desktop composer is outside the browser-only automation surface;
Computer Use guidance also prohibits operating that conversation UI.
The browser test is not evidence of a completed Codex-host integration test.
After deployment, drag one card and a multi-selection bar from the actual Codex
sidebar into its composer. If the host still rejects the transfer, capture that
result rather than claiming its public formats guarantee support. The installed
host contains image/file-specific paths but no public StashDock transfer contract.

## Cross-process input-state fix (Oct 9 follow-up)

The user confirmed that the earlier native-broker build still does not transfer
from the actual Codex browser sidebar into its composer. Earlier mock/browser
successes must not be described as end-to-end verification.

Changes in this follow-up:

- Replace the opaque `drag` wrapper with a small owned Windows adapter. Keep the
  existing origin/token/selection/preview validation and public file transport.
- Synchronize only the source thread's mouse state before OLE entry. Use actual
  physical button state for continuing/releasing, not a foreign input queue's
  stale button flags. No input injection, queue attachment or focus change.
- Carry a top-down premultiplied BGRA DIB instead of a device-dependent bitmap.
  Preview preparation failures are errors, not silently missing ghosts.
- Require an accepted copy effect as well as a completed OLE result. Distinguish
  target rejection, early mouse release and Escape cancellation in the response.
- Expose bounded, memory-only transport diagnostics to trusted local clients.
  No reference content, title, file path, launch token or conversation data.

Risk / verification boundary: these changes address an input-queue mismatch
consistent with an immediately terminating cross-process drag; that diagnosis
is not yet proven by a captured human gesture. The new telemetry is needed to
confirm actual startup, hover acceptance and the final result. OS acceptance
still does not establish that the Codex composer consumed the reference.

Verified before packaging:

- TypeScript and all 106 frontend tests pass.
- 32 native tests pass. The Windows transport integration test obtains real
  `CF_HDROP` data, reads back an actual Unicode `.md` path, and successfully
  initializes the Shell helper with a 32x32 alpha DIB. This does not start a
  user drag or operate the Codex composer.
- Browser replay: three trusted single/batch broker requests, correctly bounded
  PNG previews, quiet cancellation, propagated failure text, no stale drag state.
  Its HTTP transport endpoint is mocked; OS/Codex acceptance is not simulated.
- Public-format fallback replay: three trusted browser drops contain full context,
  connected/painted 320x112 previews, clean teardown and unchanged alert spacing.
- Extension assets remain synchronized. Arc components/layout/styles retained;
  only transport error copy changed, using the existing inline Arc Alert and
  preserving Copy for AI as the keyboard alternative.

Packaging succeeded, including all nine branded Windows icon sizes. The release
executable and `artifacts/stashdock-input-state-drag.exe` share SHA256
`4C1C279459FCE2CC3E59F5FD60048E294F25C8F0756D0DF726CAAF380EEDA5B1`.
The installer is archived as
`artifacts/StashDock_0.2.1_input-state-drag_x64-setup.exe`.

Deployment completed on Oct 9 at 15:02 (Asia/Shanghai), after the user authorized
ending the confirmed residual old process (PID 41128).

- Previous executable preserved as
  `artifacts/stashdock-before-input-state-drag-20261009-150209.exe`.
- Root executable matches the release/archive hash above.
- Restarted root executable, PID 57244; health is ready and the shelf serves
  `index-C_4hxlg3.js` with the unchanged `index-D_LUe3M4.css`.
- Trusted drag diagnostics start with `active: false` and no attempts; requests
  without the trusted client header receive 403.
- Existing Codex browser shelf reloaded and displays the saved references.
- Actual Codex composer receipt remains pending a human drag test.

## Browser-owned drag correction (Oct 9)

Human verification of the deployed input-state build still reports no preview.
Captured transport outcomes show `previewReady: true`, no accepted copy target,
one QueryContinueDrag callback with both button flags false, and 911–1833ms in
the OLE loop. Another attempt remained active for many minutes; later attempts
were rejected as already active. An alpha bitmap preparation test was therefore
not proof of a visible carried card or a usable cross-process source loop.

- Shelf dragstart no longer cancels the browser gesture or calls the HTTP broker.
- Text, Markdown, escaped HTML and URL formats remain available. Chromium's public
  DownloadURL metadata offers the same context as a Unicode-safe Markdown data URL.
  It is an experimental compatibility path, not a promise that Codex receives it.
- Legacy broker capability is no longer advertised. Requests from a non-StashDock
  foreground process are rejected before any OLE call, including queued requests.
- User authorized ending/restarting residual StashDock processes for future
  updates or hangs without repeated confirmation; this does not authorize deleting
  saved references, ending other applications, or submitting conversations.
- Existing Arc cards, controls, hover behavior and window geometry are unchanged.

Actual browser-host preview and Codex composer receipt still require human
verification. Do not call this integration complete based on unit/browser tests.

Verified source checks: TypeScript, 108 frontend tests, 32 native tests, and
extension asset synchronization. Two trusted browser gestures with an older
advertised broker capability produce zero broker requests and retain download
metadata. Three browser drops (thumbnail, selected card, selection bar) preserve
full fixture context, a connected/painted 320x112 preview, and clean teardown.
These tests do not inspect the actual Windows ghost or Codex composer receipt.

Format reference: [Microsoft Edge DownloadURL explainer](https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/DownloadURL-list/explainer.md)
describes the existing single-file `mime:filename:url` format and data URIs. This
implementation deliberately bundles a selection into one Markdown file; it does
not assume proposed multi-file formats are already supported.

Deployment completed Oct 9 at 15:42 (Asia/Shanghai). Backup:
`artifacts/stashdock-before-browser-owned-drag-20261009-154156.exe`.
Root, release and `artifacts/stashdock-browser-owned-drag.exe` share SHA256
`A6C74E8A6245049C4FB6B1EF1A534AB46660CD5EB519CD2D7D606AC54F9757F0`.
Installer archived as `artifacts/StashDock_0.2.1_browser-owned-drag_x64-setup.exe`.
Restarted PID 60756, health ready, 29 references visible, `nativeDrag: null`,
no active broker attempt. The formal shelf serves `index-BZD22rDn.js` with the
unchanged `index-D_LUe3M4.css`; all nine branded executable icon sizes match.
The existing Codex shelf was briefly moved to Vite for human preview testing,
then returned to its formal 17863 route after deployment. Actual host preview
and composer receipt are still unverified, pending the user's response.

## File-attachment trial (Oct 9)

User confirms the browser-owned build now carries a preview outside the sidebar,
but the Codex composer still refuses the drop. The user asks for attachments,
not context text inserted into an existing draft.

Read-only inspection of the installed host establishes that its drop receiver
detects file items/`Files`, ignores zero-byte files, and has a browser-file-byte
copy path in addition to its disk-path attachment path. No host IPC is invoked;
no host files, conversation input or host settings are modified.

An opt-in prototype at `/dock?surface=codex&drag=attachment` builds one UTF-8
Markdown `File` for a single card or the selected batch. It removes plain text,
HTML and URL insertion payloads, keeps DownloadURL compatibility metadata and
the already working painted preview. Filenames are flat, sanitized and truncated
by Unicode code point. Contents use the existing context builder: browser bridge
items may contain excerpts rather than full saved page bodies. Copy for AI and
the default drag remain unchanged. Do not package this prototype as a solved
integration before actual composer acceptance.

`scripts/probe-reference-file-drag.js` reports transport evidence rather than
pretending that successful dragstart means a successful attachment. Three trusted
browser drags start with valid nonempty files (105 bytes single, 195 bytes batch),
no text/HTML/URL insertion payloads and complete fixture selection data. All three
observed drops have **zero files**; the existing fixture draft remains intact and
there is no stale drag state. A non-intercepted CDP mouse probe also observes zero
files. Playwright's usual Chromium drag helper intercepts/reserializes drag data,
so neither probe proves the outcome of a real mouse gesture across Codex views.
Actual human receipt remains required and unverified. Formal executable is not
replaced; the prototype is served by Vite only for this acceptance check.

Post-trial checks: TypeScript, all 109 frontend tests and extension asset sync
pass. Default drag regression delivers context in three trusted browser drops,
retains the painted preview and 16px error gap; two legacy-capability replays
make zero broker requests. Root executable SHA256 remains
`A6C74E8A6245049C4FB6B1EF1A534AB46660CD5EB519CD2D7D606AC54F9757F0`
and PID 60756 still runs it. The existing human sidebar (tab 1) now shows the
opt-in Vite route with real saved references. No Codex composer action was
automated, no native build was shipped and human attachment receipt is pending.

## Human rejection and source-owned desktop command (Oct 9)

User confirms the File-object trial still produces no Codex composer attachment.
The standalone app remains text-based because it was never updated by that trial.
Remove the opt-in query mode, fake browser File constructor and trial probe; do
not keep asking for the same failed sidebar experiment. Its evidence above is
historical and **not** a successful integration.

Native StashDock now routes card/bar drags through its own `drag_reference_file`
Tauri command. Only the local `main` window can request it. The backend checks
foreground ownership before staging and again before entering OLE, validates IDs
and PNG bounds, reads authoritative SQLite content and stages a real .md file.
The Shell IDataObject carries CF_HDROP with an actual disk path and alpha preview.
No text fallback occurs on native rejection. Frontend duplicates are blocked;
native results/errors release the lifted-card state and use the existing notice.
Copy for AI remains intentionally a text-copy action.

The HTTP `/v1/drag` endpoint is permanently retired with 410. Remove its token
capability/client configuration and worker routing, rather than re-enabling
foreign-process input handoff. The browser sidebar retains its working preview
and public text drag but is **not fixed for composer attachment receipt**. That
would require a usable source-owned file bridge in the Codex browser host or a
different export/attach workflow; no private host APIs are called or patched.

Verification before deployment: TypeScript, 107 frontend tests and 32 native
tests pass. One source-level gesture test proves the native branch cancels HTML
transfer, invokes only IDs/PNG once, carries no browser text and clears on native
completion. Native tests read back a real CF_HDROP Unicode path, prepare the Shell
alpha helper, and check canonical context/selection order. These tests do not
exercise a real mouse drop into the Codex composer. Human desktop receipt is
still pending, and cannot be inferred from these results.

Deployment completed at 16:55 (Oct 9). Release/root/archive executable SHA256:
`CC3F710024A9D53087DCA3326FDA7658045C2A0E19EE5EB2652E3FB805548D77`.
Old executable retained as
`artifacts/stashdock-before-source-owned-file-drag-20261009-165512.exe` with the
previous `A6C74E8A...` hash. Shipped executable and installer are
`artifacts/stashdock-source-owned-file-drag.exe` and
`artifacts/StashDock_0.2.1_source-owned-file-drag_x64-setup.exe`.
PID 33988 starts the updated root executable with `D:/StashDockData`; health is
OK and 29 saved references remain. All nine executable icon sizes match brand.
Formal dock serves `index-DxXbTYQ5.js`; CSS remains `index-D_LUe3M4.css`.
HTTP drag returns 410 rather than invoking OLE. Human sidebar is back on the
formal route (no attachment trial) and reloaded after deployment. These startup
checks still do not establish native drag receipt in a real AI composer.
