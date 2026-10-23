# StashDock product surfaces

## Roles

| Surface | Primary role | Data access |
| --- | --- | --- |
| StashDock Desktop (Windows) | Visual library panel, floating folder with hover search, original-file Copy for AI and native drag into any AI app | Rust SQLite service, native file imports and Windows Shell transfer |
| ChatGPT MCP App (plugin) | The same library inside ChatGPT/Codex; AI search, reading, explicit saving and approved tag organization | Plugin-owned Node SQLite service; no Desktop dependency |
| Browser extension | Save the current page only: editable title, content and tags, with capture and screenshot | One-page writes to whichever local provider is running; names-only tag cache |

Desktop is not the parent of the other products. Each entry point works on its own
and all of them use the same per-user library.

## One library

Desktop and the plugin open the same `stashdock.sqlite3` and managed `assets`
folder, located through one per-user anchor (default application-data identifier
`app.stashdock.desktop`). `STASHDOCK_DATA_DIR` seeds the location for first setup.
Change location in either Settings moves the library for every entry point; a
missing registered library fails closed instead of creating a second one. A library
copied to another drive or computer keeps working because missing backups are
repointed to the same files under its `assets` folder.

The browser cannot open SQLite. It saves through a local provider: the plugin's
capture bridge (`127.0.0.1:17864`, running while the MCP server runs) or Desktop's
(`127.0.0.1:17863`). With neither running, the Save form shows an inline prompt
with Check again; it never shows a library or claims an unsaved draft was saved.
There is no background Windows service or login task.

## Desktop

- **Panel** (Context library): collections, pinned tags and a collapsible Tags list
  in the sidebar; search; grid (three columns, stepping down to two and one) or list
  view; import of links, notes, files and browser bookmarks; card menu (Edit card for title,
  tags and cover; Edit content for AI context); Settings. Narrow windows use the three-row
  compact header.
- **Folder**: a small topmost folder when the panel is minimized (Floating window
  On, the default). Click opens the panel; drag moves the folder; × hides StashDock.
  The panel grows out of the folder and shrinks back into it.
- **Folder search**: hovering the folder floats a search field out of it; results
  appear as a cover flow. Copy copies a reference for AI; the current card drags
  natively; clicking a card opens the library on the same search.
- Tray, global shortcut (Show or hide StashDock), Launch at login and Check for
  updates are Desktop-only.
- Copy for AI and drag deliver Markdown context plus the current original files as
  a real file group through the Windows Shell.

## ChatGPT MCP App

- Opened from the host's global navigation or a conversation panel without a model
  call; the host owns placement and pinning.
- Same library panel: collections, tags, search, grid/list, imports (links, notes,
  browser bookmarks, files chosen in the system dialog), editing, link replacement
  after confirmation, deletion and tag management, Settings.
- Add to chat adds a read-only context snapshot to the visible draft (black, then
  temporary green Added, then black). It is not a native file upload; the receiving
  AI reads file references through `get_stashdock_file` and the use-stashdock Skill.
- Model-visible tools are read-only except `save_stashdock_reference` (new notes and
  links) and `apply_stashdock_tag_changes` (exactly requested or approved tag
  additions/removals). All other mutations are App-only.

## Browser extension

Chrome and Edge use their native side panel; Firefox uses its native sidebar. All
three share one form, capture/session lifecycle and save transport.

- Clicking the toolbar button opens the Save sidebar, which follows the current tab
  and reloads on navigation while open. Save confirms in place and keeps the
  sidebar open. A saved URL asks Replace or Keep; replacement keeps the card's
  identity, favorite and edited AI context.
- No library view, bookmark import, AI actions, Settings screen or setup tab.
  Configuration lives in Desktop and the AI-hosted Settings.
- Packages are generated from `extension/` per browser. Store listings do not exist
  yet; Firefox builds are unsigned development packages.

## Settings

Desktop shows Browser extensions (Chrome, Edge, Firefox, Safari) and AI plugins
(ChatGPT, Claude). The AI-hosted panel shows Browser extensions and the Desktop app.
Safari and Claude are shown as Coming soon. Detected means a confirmed StashDock
registration, not a guess from cached packages or past handshakes. Both hosts share
the language, appearance and storage sections; only Desktop has startup, shortcut,
Floating window and update settings.

## Platform status

The released product is Windows x64 only. The data-path resolver knows macOS and
Linux conventions, but there is no tested Mac desktop, plugin runtime or renderer.
See the [Mac migration handoff](MAC_MIGRATION_HANDOFF.zh-CN.md).

## Retired — do not reintroduce

The compact Dock/small panel, the browser shelf (library cards inside the
extension), the plugin's HTTP adapter to a running Desktop, and the browser drag
broker were removed. The plugin always uses its own local-library adapter over the
shared library. Earlier records: [history](history/README.md), for example the
[browser extension acceptance](history/browser-extensions-20261016.md).
