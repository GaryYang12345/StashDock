# Dashboard / MCP consistency review, 0.4.6

## Shared owners

Reference menu labels and glyphs now come from `src/components/referenceActions.tsx` in both dashboard and MCP App: Pencil for Edit card, FileText for Edit content (16px, 1.75 stroke), MoreHorizontal for the trigger (20px, 1.75 stroke). The MCP trigger now uses the same more-action wrapper and circular icon-button class as the dashboard. Source visit icons match the existing dashboard's 14px size.

Rename tag / Remove tag also come from this shared module. The desktop-only Pin / Unpin actions remain in Sidebar and are never included in the MCP App. Both surfaces use ReferenceEditor, ContentEditor, TagEditor, FluidDialog, DesktopMenu and shared card/action CSS. The App also mounts the existing TooltipLayer and supplies the dashboard's favorite/delete tooltip text. Keep reference now uses the dashboard's secondary button variant.

The deliberate platform difference remains: desktop Copy for AI / file drag versus MCP Add to chat / draft resource attachment. No desktop executable replacement was necessary: its approved icon geometry and styles are the baseline preserved by this refactor.

## Tag interaction

Removed Manage tags / Browse all tags from the mounted App, and removed the eight-tag limit. Tags opens an Arc Popover containing one ScrollArea and all filter options. Each tag has the dashboard's right-click menu with exactly Rename tag and Remove tag. The contextual menu portals inside the popover so opening it does not dismiss its parent. Existing TagEditor handles save, removal confirmation, cancellation, errors and auto-close; it restores focus to the Tags trigger. Keyboard Shift+F10 opens the same context menu. No pin controls or pinned storage exist in the MCP App.

## Checks

- TypeScript build passed; all 156 frontend tests passed. Added shared-action and tag-path regression checks.
- Plugin build passed; 0.4.6 installed from local personal marketplace. Resource is `ui://stashdock/shelf-v8.html`.
- Installed stdio smoke verification confirms current version/resource, both responsive breakpoints, no legacy tag entries and the actual library's 29 references without body disclosure.
- `scripts/verify-mcp-tag-consistency.js` passed against a disposable mcp-test fixture only: correct rendered content icon/stroke, ten reachable tags, two contextual actions, rename persistence, cancel-safe removal, confirmed removal without reference deletion and untouched draft. No browser page errors.
- Keyboard Shift+F10 and Escape checked on the tag row.
- `scripts/verify-mcp-responsive.js` checks one/two/three columns, button bounds and page/card overflow at 13 panel widths in both light/neutral and dark/blue themes. The previous 380px / 720px responsive behavior is retained.
- Visually inspected `output/playwright/mcp-046-tag-context.png`. This is an isolated preview, not an assertion that the currently connected Codex process has reloaded.

## Arc review

Reused installed Arc Popover, ScrollArea, Button and existing Radix/Arc product menu adapter; no vendor internals were restyled. Semantic color/type/spacing tokens are preserved. No new helper copy, pointer focus ring or motion preset was added. Right-click has a keyboard path, destructive operations have confirmation, and shared editors retain focus/error/pending behavior. The online Popover markdown was unavailable to the browsing tool; the installed component's documented typed API was inspected instead. No lint command exists in this project.

Previous installed plugin files were saved to `artifacts/plugin-before-consistency-046-20261010` before updating. The user's actual tags, content and draft were not changed by the UI tests. Codex itself was not restarted; existing connections may require a restart before loading the new plugin resource.
