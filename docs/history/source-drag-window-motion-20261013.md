# Source-owned dragging and spatial window handoff

Status: rejected after real user acceptance. The opaque full-source drag image
and native frame-resize morph described below were replaced by the lightweight
Shell drag image and stable-frame content handoff. This file is historical
investigation evidence, not the current product contract.

## Recoverable version

The pre-change source, installed executable/UI/plugin and consistent library
snapshot are preserved in
`D:/StashDock/artifacts/before-source-drag-window-motion-20261013`.
Deployment replaces executable code only, never the user's SQLite library.

## Design and ownership

- The native drag image captures the actual complete selection bar, grid card or
  list row. It does not independently redraw a miniature first-selected card.
  Windows OLE still transfers the same canonical Markdown file via CF_HDROP.
- A temporary source-owned layered window preserves alpha 255 on solid surfaces
  and transparency only outside rounded corners. It follows the pointer hotspot,
  takes neither input nor focus, and is disposed after every OLE result/error.
  This is not another permanent dashboard/shadow window.
- Visible source pixels are prepared before the gesture. The cache has eight
  entries, one warming task at a time and a main-window lifecycle cleanup. Actual
  markup, dimensions, DPI and theme identity validate cached pixels. A changed
  source falls back to bounded fresh capture; late completion cannot start OLE
  after timeout. Preparing pixels never exports reference contents.
- Each source is bounded to 2048×1536, two million pixels and a 2MiB PNG payload.
  Preparation timeout is three seconds; OLE already has a bounded cancel path.
- The native coordinator moves/resizes the real opaque panel toward/from the
  folder's artwork bounds. Arc supplies smooth, non-overshooting timing (400ms
  open, 300ms close); no panel opacity or text scaling is animated.
- The renderer locks its final layout once. Container queries retain the final
  navigation layout while the native frame clips it; there is no per-frame
  React render or frontend geometry IPC. Reduced motion bypasses travel.
- Cancellable IDs prevent old frame jobs from overriding new requests. A bounded
  readiness fallback commits if the renderer is suspended. Final geometry is
  restored before persistence; maximized placement remains Windows-owned.
- Native client-size compensation is applied exactly once. Repeatedly applying
  Tao's undecorated-shadow size adjustment previously accumulated frame width.

## Verification

- TypeScript and production frontend build passed; canonical extension assets
  match. Frontend suite: 230 passing tests.
- Native suite: 70 library, 2 startup and 18 preview-helper tests passed; the
  existing clipboard-writing test remains intentionally ignored.
- Real source browser replay captured a full 560×92 selection bar and 279×282
  card with center alpha 255. Warm selection-bar lookup took 0.1ms; changing
  selection text invalidated its pixels. Clipping a 1130px layout to a 260px
  viewport retained the 224px sidebar and vertical navigation.
- The installed production application opened with the development server
  stopped, using packaged assets and all 45 saved references.
- Two actual installed-window folder/panel round trips retained the same
  1157×769 outer frame (1142×760 client preferences); main remained non-topmost,
  folder topmost, with no dashboard custom region.
- The first cold native drag replay revealed a released-before-start timing
  problem; preparation was added before final acceptance. The full-source
  raster, cache invalidation and no-late-start safeguards are tested separately.

Native rapid reversal, suspended-renderer and reduced-motion replay scripts are
updated, but their actual WebView/CDP runs were not performed: the extra debug
launch was blocked. These are not represented as runtime acceptance. Native
drag/drop visual acceptance is recorded below only after actual replay.

## Installed final build

SHA-256: `DA2BF6C30E4FD9AC247E68120D82338FDCD529C7E74F59A08E147CC9BB18E0DB`.
It was reopened with the dev server stopped, shell-owned outside Codex's process
tree. The final automated native bar gesture reached the source-owned command,
but the automation released its button before the OLE loop began. It correctly
returned `released-before-start`, left `active=false` and no drag-preview window.
The automation has no supported sustained-button API; sustained native visual
acceptance is therefore explicitly requested from the user, not claimed from
the browser raster or source-pattern checks.
