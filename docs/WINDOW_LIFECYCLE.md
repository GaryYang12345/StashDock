# Desktop window lifecycle

`desktop_window_policy.rs` defines product modes and resolves intents without
Tauri or platform APIs. `desktop_windows.rs` owns execution, geometry, readiness,
failure rollback and the compatibility status sent to the mounted frontend.
`window_frame.rs` contains scoped platform operations, not product decisions.

| Mode | Panel | Folder | Taskbar entry |
| --- | --- | --- | --- |
| Panel | Normal or maximized | Hidden | Main window |
| Folder | Minimized | Visible, topmost | Main window |
| Minimized | Minimized | Hidden | Main window |
| Hidden | Hidden | Hidden | None unless user pinned it |

Minimized is only selected with Floating window Off. Hidden requires an explicit
Hide action; it is not a synonym for system minimization. Loss of foreground
focus does not collapse the panel.

All entrypoints submit Open, Minimize, Toggle, Hide or ShowLast. The native
executor applies the resolved mode once. No entrypoint independently calls
show/hide/minimize. Preference changes normalize an incompatible mode through
the same executor before committing the new policy.

Native size/focus events are observations, not authoritative replay commands.
When they indicate a real minimize/restore mismatch, at most one reconciliation
is queued outside the callback. It re-reads current native facts and current
product mode on the owning UI thread. Pending transitions suppress their own
notifications. A shortcut folds native facts into its decision without first
presenting an intermediate mode. Hidden cannot be resurrected by an old event.

The last non-iconic panel frame is cached in memory, independently of frontend
readiness. Native minimization can move the HWND to iconic coordinates before
the event is handled; those coordinates must never determine folder placement.
Saved client geometry and the folder's pre-expansion return anchor remain
separate from that transient native frame.

## Acceptance

- Repeated native system Minimize and Restore, including the second and later
  cycles, with Floating window On: Panel → Folder → Panel, taskbar retained.
- Repeat with Off: Panel → Minimized → Panel, no folder.
- Repeat app-button and folder-Open transitions, mixed with native commands.
- Rapid shortcuts following native commands, explicit Hide followed by queued
  notifications, preference changes, maximized panels and edge placement.
- Confirm mounted selection, query, tags and scroll survive; panel keeps normal
  Z-order, only the folder stays topmost; no permanent cloak after failures.
- Static source tests or activating a minimized window alone do not validate
  the native minimization direction. Test Windows' own minimize command.
