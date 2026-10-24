# Desktop window lifecycle

`desktop_window_policy.rs` defines product modes and resolves intents without
Tauri or platform APIs. `desktop_windows.rs` owns execution, geometry, readiness,
failure rollback and the status sent to the mounted frontend
(`desktop-window-state`). `window_frame.rs` holds scoped platform operations
(transition suppression, cloaking, frame metrics), and `window_morph.rs` the
Windows spatial handoff; neither makes product decisions.

| Mode | Panel (`main`) | Folder (`folder`) | Taskbar entry |
| --- | --- | --- | --- |
| Panel | Normal or maximized | Hidden | Main window |
| Folder | Minimized | Visible, topmost | Main window |
| Minimized | Minimized | Hidden | Main window |
| Hidden | Hidden | Hidden | None unless user pinned it |

Minimized is only selected with Floating window Off. Hidden requires an explicit
Hide action (folder ×, panel Close with Floating window On, tray); it is not a
synonym for system minimization. With Floating window Off, Close quits. Loss of
foreground focus does not collapse the panel.

All entry points (window buttons, folder, tray, global shortcut, single-instance
activation, native minimize/restore) submit Open, Minimize, Toggle, Hide or
ShowLast. The native executor applies the resolved mode once; no entry point calls
show/hide/minimize on its own. Preference changes normalize an incompatible mode
through the same executor before committing the new policy.

## Handoffs

- Expand hides the topmost folder before the panel is revealed; collapse reveals the
  mounted folder and minimizes the real panel, keeping its taskbar entry. Never
  substitute Hide for Minimize or create a placeholder taskbar window.
- On Windows both directions run the spatial handoff (`window_morph.rs`) between
  preparing and revealing the real windows: the overlay draws DWM thumbnails while
  the real windows are cloaked, then hands over in one composed frame. Ordering,
  rollback and focus are unchanged. With Animation effects off, or any DWM
  failure, the direct handoff runs instead, with OS entrance/exit fades suppressed.
- A taskbar restore reopens the panel and dismisses the folder. Minimized frame
  metrics are restored under a scoped cloak before placement; the cloak is always
  removed on failure.
- Visibility goes through Tauri on the owning UI thread, never raw `ShowWindow`, so
  Tao's cached visibility stays correct.

## Placement

- The panel keeps its settled size and opens centred on the visible folder
  artwork, clamped to the monitor work area; maximized placement stays
  Windows-owned.
- Edge clamping on expansion does not move the folder's return anchor. An unmoved
  panel collapses back to the pre-open folder position; a moved panel collapses
  into its current centre, clamped to the work area.
- The last non-iconic panel frame is cached in memory. Native minimization can move
  the HWND to iconic coordinates before the event is handled; those coordinates
  never determine folder placement.

## Folder search window

The `search` window (`folder_search.rs`) is attached only while the folder is the
visible surface; it closes and detaches when the folder hides. It is topmost,
taskbar-free and non-activating until its field is pressed; closing returns focus
to the previous window. Hover over the folder or the search is combined into one
180 ms intent delay both ways. Its native region covers only the visible field and
cards (empty when closed). Placement centres on the folder's optical axis, always
opens above the folder (near the top of the screen too), and never moves the folder. A press
on the folder (to open or drag it) puts the search away first.

## Native events

Native size/focus events are observations, not authoritative replay commands.
When they indicate a real minimize/restore mismatch, at most one reconciliation
is queued outside the callback. It re-reads current native facts and the current
product mode on the owning UI thread. Pending transitions suppress their own
notifications. A shortcut folds native facts into its decision without first
presenting an intermediate mode. Hidden cannot be resurrected by an old event.

## Acceptance

- Repeated native system Minimize and Restore, including the second and later
  cycles, with Floating window On: Panel → Folder → Panel, taskbar retained.
- Repeat with Off: Panel → Minimized → Panel, no folder.
- Repeat app-button and folder-open transitions, mixed with native commands and
  rapid reversals; check the handoff frame by frame (development builds can record
  composed frames, see `window_morph.rs`), with no real window and drawn copy (or
  two shadows) visible together.
- Rapid shortcuts following native commands, explicit Hide followed by queued
  notifications, preference changes, maximized panels, edge placement and moved
  panels.
- Folder search: hover open/close, typing, Copy, drag and open-in-library, with
  focus returned to the previous app and no click capture in transparent areas.
- Mounted selection, query, tags and scroll survive; the panel keeps normal
  Z-order and only the folder (and its search) stays topmost; no permanent cloak
  after failures.
- Static source tests or activating a minimized window alone do not validate the
  native minimization direction. Test Windows' own minimize command on the packaged
  build.
