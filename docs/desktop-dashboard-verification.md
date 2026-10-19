# Desktop dashboard update (2026-10-10)

## Scope

Native folder/dashboard only. The installed Codex plugin remains 0.4.3 and its
UI and server bundle hashes are unchanged. Browser capture behavior is unchanged.
The compact native Dock snapshots are in `archive/compact-dock-20261010`; the
legacy browser `/dock` remains supported but is not mounted by the native shell.

- Folder click and visible-window shortcut open the dashboard directly.
- Minimize returns to the folder at the moved dashboard's current center; close
  hides the taskbar window and retains the tray. No compact resize control.
- Shared gray titlebar/sidebar/header, separated by quiet semantic-token borders.
- Three card columns by default; main container <=820px uses two, <=580px one.
- Tags on the image's lower-left edge. Long names ellipsize with accessible names.
- Hover image actions use neutral translucent gray token roles. Copy remains
  hover-only, with keyboard/coarse-pointer access and existing green confirmation.
- Three-dot menu edits title and tags. Narrow cards reserve a full URL row rather
  than squeeze the URL beside Copy. The card title does not reflow on success.
- Sidebar tags: left-click filters, right-click rename/remove with Lucide icons;
  removal requires confirmation and retains references. No Clear tag button.
- Arc Input/Button/Alert/Dialog and menu styling are reused. A Radix menu platform
  adapter binds portals and collisions to the visible pane, not the full native
  transparent canvas. No Arc vendor source changes, Pro imitation or new theme.

## Data writes

Native `edit_item` updates only title/tags/time and FTS. `change_library_tag` uses
an immediate transaction, reads current records and updates tags/FTS atomically.
Validation limits: nonempty title <=500 characters; <=12 tags, <=48 characters
each, case-insensitive duplicates removed. Favorite, body, assets, original path
and provenance are not overwritten. Errors preserve the previous UI snapshot.

## Checks

- Type check and frontend build passed; 134 frontend and 34 native tests passed.
- Initial native compilation hit memory/metadata errors on a nearly committed
  Windows machine. Removed only reproducible StashDock package build artifacts
  with scoped Cargo clean, then used one Cargo job. Saved data and the running
  previous EXE were not removed. Missing optional debug PDB warnings are benign.
- Own browser contexts used copied metadata/screenshots from six saved references;
  all mutation tests targeted isolated browser storage, never the user's library.
  Both light/neutral and dark/blue passed at 320/390/768/1024/1180/1440: no horizontal
  overflow, three default columns and one at narrow widths.
- Verified tag click versus right-click, rename persistence, tag remove cancel/
  confirm without deleting cards, card title/tag save and reload, protected field
  preservation, Escape, editor trigger-focus return, and menus inside an offset
  simulated native pane's bounds. This is not native screen automation.
- Screenshots inspected after theme transitions settled; narrow URL clipping was
  corrected. No live screen reader or actual native pointer automation available.
  No lint command configured. Semantic tokens, reduced motion and no pointer
  focus outlines reviewed. Compact targets use desktop density and 44px on touch.
- Windows release/NSIS packaging and all nine embedded brand-icon sizes passed.
  Replaced `D:/StashDock/stashdock.exe` and restarted only that verified process.
  Health API returned `ok: true`. All 29 saved reference rows had the identical
  SHA-256 before and after restart, including their metadata and content.
- Installed EXE SHA-256:
  `6216C669B99404FD3C2C05C60F8BAB94A182FB239DCD12DF156AD7E501284BA5`.
  Previous executable preserved at
  `artifacts/stashdock-before-dashboard-20261010.exe`.
- Own Playwright browser and preview server were closed after verification.
