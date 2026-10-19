# Lightweight drag images and stable native handoffs

## Current decision

The user rejected DOM-screenshot drag previews and native frame morphing for
latency and poor motion. The previous code/executable remain recoverable in
`artifacts/rejected-source-morph-20261013`; the earlier baseline and library
backup also remain intact. No collection restoration is performed.

- Cards retain the original 320×112 lightweight drag presentation.
- Selection-bar drags synchronously paint the current complete bar using its
  measured layout, Arc tokens, live text ranges and installed Lucide SVG paths.
  They never look up the first selected card or thumbnail. Canvas readback uses
  the software-friendly `willReadFrequently` hint; no screenshot/font fetch,
  warming cache, observer or cursor-following popup exists.
- Windows' `IDragSourceHelper` owns the usual translucent Shell image. OLE,
  CF_HDROP, canonical Markdown export, held-button guard and real drop outcomes
  remain unchanged. Copy for AI still produces the same real file.
- Native panel/folder windows retain their actual size, region, shadow and
  normal/topmost policy. Native bounds do not animate. The frame-delta fix is
  retained only for restoring an actual saved client size.
- One renderer controller owns content movement: 120ms departure, 160ms entry,
  from Arc's tokens, using only 4–8px `transform` translations through native
  Web Animations. It does not depend on Motion's global keyframe-resolution
  queue; isolated `y`/per-frame JS updates are also avoided. There is no opacity
  change, text scale or layout clip.
- Incoming content is prepared while hidden, then revealed at its full frame.
  Departure completion is ID/sender validated; native fallback is bounded to
  350ms if a renderer is unavailable. Reversal, hide and disposal invalidate old
  callbacks; reduced motion settles immediately. The shelf is not remounted.

This follows the performance principle in Microsoft's animation guidance:
prefer independent transform animations over dependent layout/per-frame work.
See https://learn.microsoft.com/en-us/windows/apps/develop/performance/optimize-animations-and-media.
Arc's in-page expandable-card does not supply a cross-HWND window lifecycle;
existing Arc controls/tokens are retained instead of replacing native windows
with an imitation card overlay.

## Verification

- TypeScript, production frontend build and all 230 frontend tests passed.
- Native tests: 68 library + 2 startup + 18 preview-helper passed; the existing
  clipboard-writing test remains intentionally ignored.
- Actual browser raster/motion replay captured the bar at its real 560×91 size
  and original 320×112 card image. Bar preparation was 3.9ms, card 2.2ms in the
  successful replay; final responsive replay measured 5ms/2.9ms. These are
  fixture measurements, not universal guarantees.
- Real native-animation replay observed Web Animations transform keyframes, unchanged
  dimensions and opacity=1 across timed intermediate frames, then transform
  cleanup. Reversal, stale acknowledgement, hide, disposal and dynamic reduced
  motion are separately covered by deterministic controller tests.
- Responsive raster dimensions are checked at 390/768/1024/1440 in both themes.
- Native visibility/geometry acceptance and final library fingerprint are
  recorded after installing the verified production executable.

## Installed acceptance

Installed SHA-256:
`6C52382FC5BFA2D182C8EA910C5619CB4EFBA8EEE4CBDF00D11D1FCC90A64DDE`.
The executable opened normally with the development server stopped and its
launcher handed to Explorer (not a Codex-owned child).

Three real folder/panel round trips completed. Read-only native probes sampled
1,821 frames over 30 seconds and 3,737 frames over 60 seconds. Both directions
were observed; the panel remained `[422,75,1157,769]`, the folder
`[833,367,160,232]`, including intermediate visibility handoffs. The panel stayed
non-topmost with its native resize frame/DWM non-client rendering and no custom
region; the folder retained its independent topmost bounded region.

Before/after the installation and UI checks, all 45 collection rows and pinned
tag preferences retained identical fingerprints:
`e97232b31a52b3469ad4aef6d83bc80c4e05ca72985e628916d85e9d4dca977e`
and `631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864`.

Sustained native drag imagery cannot be photographed with the automation tool's
short drag gesture. The system Shell path is restored to the prior accepted
implementation, its real bitmap/CF_HDROP native test passes, and bar pixels and
preparation latency were rendered and inspected separately. Native CDP rapid
reversal/suspended-renderer scripts were not rerun; controller regressions are
not represented as those runtime checks.

Arc review: no new colors, type, controls or copy patterns; existing card/bar
layout owns spacing and SVG geometry. No nested/transparent dashboard canvas,
Pro component reconstruction, new focus treatment or text-scale animation.
Native frame/shadow ownership is preserved. This task changes standalone
window/file-drag capabilities, not the MCP composer's action or extension Save.
