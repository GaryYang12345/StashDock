# Save sidebar, platform marks and window shadow

## Current product decisions

- Companion 0.4.2 opens a native, save-only browser sidebar. The webpage card,
  host injection, dragging, iframe resource exposure and redundant card shell
  are deleted. Shared Arc Input, Textarea, Button, Alert, Skeleton and tag fields
  remain. One shared scrollbar stylesheet covers desktop, Codex and extension.
- Save commits edited title/content/tags and a bounded screenshot, then closes
  the sidebar. Opening or dismissing does not save. Tab navigation invalidates
  the draft without reading another page. Worker requests check the own extension
  page, window, captured tab/URL and token; window removal cleans session state.
- Chrome 141+ is required for native automatic close. This adds only sidePanel
  to the existing activeTab/scripting/storage permissions, not all-site access.
  [Chrome's sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
  documents the gesture requirement for open and Chrome 141 support for close.
- International entries precede Chinese ones: X, Instagram, Reddit, LinkedIn,
  Pinterest, Xiaohongshu, Zhihu. Pinterest and Instagram use the supplied images,
  resized to local 128px assets without changing the user's originals. X has a
  2px optical inset inside the same 20px alignment slot.
- The entry preview is a static 24px X/Xiaohongshu/Zhihu stack, with 20px interiors
  matching browser-source icons, 2px pure-white rings, 8px overlap and a separate
  ellipsis. Platforms is only a visually hidden accessible name. Zhihu retains a
  blue disc with no white-corner seam. Lists use original shapes, not discs.

## Native shadow architecture

The main WebView lives in a permanent larger HWND whose region clips to the
visible panel. Simply enabling a DWM shadow or adding CSS would shadow the wrong
outer bounds or clip the visible blur. A small owned Win32 layered window instead
draws a neutral, rounded shadow outside the panel without enlarging its input
region. This is a native custom shadow, not a claim that DWM draws this region.

The shadow is click-through, non-activating and absent from taskbar/Alt-Tab. Its
interior is completely transparent. UI-thread subclass events follow native move,
hide/show and owner destruction; bitmap geometry is bounded and cached by size,
radius and DPI. Native dragging needs no per-pixel WebView IPC. The shadow is hidden
for the folder and transitional envelopes. Expanded panels remain non-topmost.
[Microsoft's layered-window documentation](https://learn.microsoft.com/en-us/windows/win32/winmsg/window-features#layered-windows)
describes per-pixel alpha and WS_EX_TRANSPARENT hit-through behavior.

## Verification

- 234 frontend tests pass; native tests pass with one pre-existing ignored network
  test (90 passed total). Added shadow alpha/cutout and sidebar authorization regressions.
- A genuine Chrome toolbar gesture created the native sidebar in an owned test
  profile. Tested 320/390/480/768 widths and short/tall hosts, light/dark themes,
  no webpage overlay, always-reachable Save, edited values, selected tags, durable
  offline save and automatic close. Synthetic queues were cleared afterward.
- Native verification checks ownership, transparent/non-activating/tool styles,
  normal window Z-order, click-through hits and movement without changing the
  user library. Folder/reopen and tray-hide/show behavior passed against the
  installed application. Diagnostics use per-monitor DPI awareness; the actual
  outside-window shadow was visually inspected, not inferred from CSS.
- Platform lists/navigation and custom-platform persistence use isolated fixtures.
  This is not acceptance of signed-in Pinterest/Instagram content extraction.
- Final installed desktop passed with development servers stopped: packaged
  frontend, import tabs, platform entry and minimize/reopen. Code hashes match
  deployed desktop/plugin assets; all 43 reference metadata rows match the recovery
  snapshot. Normal startup was restored and temporary debug endpoints closed.

Recovery snapshot: artifacts/before-sidepanel-shadow-20261013. Existing browser,
library and retired login data are preserved. Reload Companion after deployment;
reconnect the Codex StashDock plugin and reopen its shelf for URI v32.
