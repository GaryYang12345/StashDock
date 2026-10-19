# Platform and capture-card polish — 2026-10-13

Historical 0.4.1 notes. Superseded by sidepanel-shadow-20261013.md: the draggable
webpage card has been removed, and the preview stack now uses Zhihu again.

## Shared design

- The platform preview is a static X / Xiaohongshu / Reddit stack: 28px images,
  2px pure-white rings, 6px overlap, and a separate muted ellipsis. No hover
  animation or outer grey stroke. This is brand navigation, not Arc's interactive
  people/presence AvatarGroup; it follows the supplied static-stack reference.
- Platform rows use original marks, not avatar discs. Custom platforms resolve
  favicons through the same services.icons pipeline, in batches of at most 12.
- Product hints remain black with white text in both themes. Platform names,
  tag names and uploaded filenames use the shared hint layer rather than native
  browser title tooltips. The Arc file-upload change is an attribute-only adapter.
- Existing shared Arc fields, buttons, popovers, spacing and typography remain
  the basis for desktop, Codex and extension surfaces.

## Movable browser save card

Extension 0.4.1 replaces the non-movable native action popup with a website-level
floating card: translucent grey shell, rounded white inner form, draggable header,
keyboard movement and viewport clamping. Save remains visible at the bottom.

The toolbar gesture captures the current page before mounting the card. An
extension-origin iframe lives inside a closed shadow root in the browser top
layer. Worker messages check the sender, tab, URL and per-capture token. Trusted
parent messages control movement and dismissal. Session storage retains at most
eight transient capture records through worker suspension. A successful durable
save closes the card; dismissing without confirmation does not save.

Permissions remain activeTab, scripting and storage, plus the local library
bridge. Web-accessible UI resources do not grant website-reading permission.
Browser-internal pages cannot host the card. Login state remains in the user's
existing browser; no new profile, cookie export or remote debugging is required.

## Verification

- Frontend regression suite: 234 passing tests, including floating-frame isolation
  and static-brand-stack contracts.
- Real toolbar gestures in an owned Chrome profile: 390 / 768 / 1024 / 1440px,
  light and dark themes, reduced motion, pointer and keyboard dragging, viewport
  clamping, tag selection, no implicit save, durable offline save and auto-close.
- Screenshot dimensions verified at 720 × 425; capture precedes the UI.
- Eight desktop/Codex platform-layout cases passed. Actual Codex card hints were
  inspected in both themes: rgb(13,13,13) background and white text.
- Installed desktop verified with the development server stopped: packaged
  tauri.localhost assets, all import tabs, platform navigation and minimize/reopen.
  Light/dark hints were verified again in the installed WebView; the expanded
  panel is not topmost. Temporary debugging is removed before normal restart.
- Browser fixtures use isolated storage and a disabled loopback transport;
  synthetic queued imports are cleared after testing. This is not an acceptance
  test of every signed-in platform's extraction adapter.

Recovery snapshot: artifacts/before-floating-polish-20261013. The current library
contains 43 references, including a real reference added during development;
the earlier 42-reference snapshot must not replace it.

After deployment, Reload the unpacked browser extension. Reconnect the StashDock
Codex plugin and reopen its shelf so an already-running MCP worker loads the new
code and shelf URI. No user browser or Codex process is forcibly restarted.
