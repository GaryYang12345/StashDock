# StashDock product surfaces

## Roles

| Surface | Primary role | Data access |
| --- | --- | --- |
| AI-host MCP App | A complete basic reference library inside Codex; reusable for other MCP Apps hosts | Plugin-owned, headless Node SQLite service. No desktop application dependency. |
| Windows desktop | Visual desktop bookmark/library manager; file drag and Copy for AI for any AI application | Rust SQLite service, native file imports and Windows drag integration. |
| Browser companion | Save current page only: editable title/content/tags, capture and screenshot | One-page writes to either local service; session drafts and names-only tag cache. No shelf or bookmark import UI. |

Chrome and Edge use their native side panel; Firefox uses its native sidebar.
All three share the same form, capture/session lifecycle and save transport.
Generated manifests and the sidebar API adapter are the only browser-specific
extension layers. Settings in Desktop/MCP include each supported browser; Safari
remains a planned placeholder. See [browser acceptance](browser-extensions-20261016.md).

The desktop app is not the parent of the other products. Both local services open
the same `stashdock.sqlite3` and managed `assets` directory. `STASHDOCK_DATA_DIR`
overrides the platform's application-data directory for **both** services. With no
override in a stale Windows host environment, the plugin launcher also checks
the existing Windows user environment setting, matching the desktop launcher.
This does not copy, move or merge library records. With no configured
override, the identifier is `app.stashdock.desktop`. SQLite WAL, a five-second busy
timeout, explicit transactions and record-level changes prevent whole-library
snapshot overwrites. Both implementations use the same base SQL schema and keep
the desktop FTS index updated.

Only Windows desktop packaging is supported in this phase. The portable data-path
resolver includes macOS/Linux conventions, but that is not a tested Mac desktop
release. A future Mac native adapter must preserve the same product functions.

## Why the old plugins required a running desktop

Local data alone does not give every process access to it. The old plugin called
the desktop's HTTP API on port 17863. Closing the desktop removed that API. Browser
extensions cannot open arbitrary local SQLite files, so they still need a local
service to synchronize the shared collection, even though they can save captures
and cached references in their own local storage independently.

The MCP plugin now uses `node:sqlite` directly (Node 22.13 or newer). It starts a
restricted capture bridge on `127.0.0.1:17864` while the MCP server is running.
Browser requests try that bridge first and the desktop bridge second. With
neither service running, the Save form shows an inline connection prompt and
Check again. It does not expose a library or Settings screen, open a setup tab,
or claim a pending browser draft is saved. Unfinished legacy operations are
retained for recovery without fetching the library. Current saves use a compact
acknowledgement; uncertain responses keep the form open for an explicit retry,
with a shared bounded receipt preventing duplicate replacement.
Opening or refocusing the sidebar resumes bounded connection checks and reads.
There is no hidden Windows service, login task or network daemon installation.
Browser quota errors are shown, never silently resolved by evicting captures.

The retired browser shelf and HTTP MCP adapter have been removed. The plugin
always uses its independent local-library adapter and the authoritative shared
library anchor. No legacy desktop HTTP override selects a second data source.

The visual App advertises both global-sidebar and conversation-panel entrypoints
with the same brand icon/resource. Users can open it without a model call. The
host owns navigation placement and pinning; the plugin does not modify host UI.

## MCP App functionality and boundaries

- Import bookmark HTML, links and notes; import managed file copies through
  explicitly selected files (up to 10, 5 MB each, 10 MB total).
- Filter by collection, text and tag; favorite, confirm deletion, assign tags to
  one reference or a selected group, rename and remove library tags.
- A short Arc DropdownMenu shows common tags. Browse all tags opens a scrollable
  management dialog, rather than an unbounded offscreen menu.
- Responsive dashboard cards: two columns at 600 px and wider, one below it.
- Add to chat retains the existing visible-draft contract and capability guard.
  No automatic message, hidden context update or pasted reference ID.

Search/retrieval tools visible to the model remain read-only. Tags are reusable
context groups, with tag discovery, paginated search and bounded batch reads.
`save_stashdock_reference` creates a user-requested context note or link without
fetching URLs or editing existing assets. `apply_stashdock_tag_changes` applies
only explicitly requested or approved add/remove patches, preserves unmentioned
tags and skips stale revisions. Both are bounded and validated. Other management mutators remain
`ui.visibility: ["app"]` and `readOnlyHint: false`; destructive tools also mark
`destructiveHint: true`. User actions stay separate from model retrieval. The
capture bridge accepts only the extension contract, validates Host/Origin,
limits bodies, and provides no SQL, arbitrary path or shell route.

File imports retain actual bytes; text-like files also store searchable text.
Other files (including PDFs) retain a managed original, not a fabricated body
extraction. Adding a file includes reading requirements and its reference ID
outside editable annotations. The model resolves it through `get_stashdock_file`,
then reads the original using permitted host tools and the appropriate file skill.
Resolving a path explicitly reports `contentRead: false`; it is neither parsing
nor a native upload. Missing/inaccessible/unsupported originals must be disclosed.
The App rejects Add preparation if the selected original is missing or outside
managed assets. Deleting a record leaves its managed file copy recoverable and does
not delete its original. Plugin/native reads are fresh on Refresh and window
focus. Simultaneous inactive views are not a live collaboration session.

The desktop Tags navigation is collapsed by default, with a chevron, count and
nested rail when expanded. Pinned sits above Tags and shows pinned tags without
removing them from Tags. Left click filters; right click offers pin/unpin,
rename/remove. Desktop pins persist and follow tag rename/remove atomically.
The native compact Dock and browser shelf are retired: clicking the folder opens the dashboard
directly. Desktop cards default to three columns, stepping down to two/one in
narrow content areas, with tags on the image and an edit menu for title/tags.
These layouts compose shared Arc controls and host-specific adapters, not a second
design system. The MCP shelf uses the same reference cards, with one/two/three
columns according to host width. The browser companion contains only its Save page form.
