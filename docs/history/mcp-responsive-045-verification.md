# MCP App responsive correction, 0.4.5

## Cause and scope

The live Codex MCP App main element measured 439.333 CSS pixels wide. Its old 600px two-column threshold therefore produced one column. The 1000px three-column threshold also kept smaller expanded views at two columns. Physical screenshot pixels are not the iframe's CSS width.

Only the MCP App layout changed. Desktop sizing, cards, library data and attachment behavior are unchanged. Shared Arc components and product tokens were preserved; no component internals, focus styles, colors or typography were restyled. The user's compact two-column requirement overrides the Arc skill's generic page-collapse recommendation.

## Layout

- Below 380px: one column.
- From 380px to below 720px: two columns, including the observed default sidebar width.
- From 720px: three columns, capped at three even on wide views.
- Named `shelf` container queries use the App width, not the outer window. Single-column fallback no longer overlaps higher-width queries.
- Loading placeholders use the same grid as loaded cards.

## Verification

- `npx tsc -b`: passed.
- `npm run test:frontend`: 154 passed.
- `npm run plugin:build`: passed.
- `scripts/verify-mcp-responsive.js`: 26 rendered cases passed (light/neutral and dark/blue), with a 1440px outer browser and independently resized embedded panels at 320, 360, 379, 380, 390, 439.333, 600, 719, 720, 768, 900, 1024 and 1440px.
- Verified actual row counts, no page/card horizontal overflow and all card buttons within card bounds. Boundary cases test both sides of each query. No page errors.
- Visually inspected `output/playwright/mcp-045-light-439.png` (two columns) and `output/playwright/mcp-045-light-900.png` (three columns). These are isolated preview screenshots, not the live Codex panel.
- Arc checklist review: change introduces no new components, copy, raw colors, focus overrides or motion. Existing spacing, states, keyboard semantics and reduced-motion behavior remain unchanged. Responsive render checks passed in both themes. No lint command is defined by the project.
- `codex plugin add stashdock@personal --json`: installed 0.4.5.
- `scripts/verify-installed-mcp-context.mjs`: fresh installed stdio server reports 0.4.5 and `ui://stashdock/shelf-v7.html`, includes both new breakpoints and lists the same 29 references without body disclosure.

## Live-host limitation

The already-running conversation's `open_stashdock` still returned `shelf-v6.html` after installation. A freshly opened MCP App tab in that conversation still contained the old 600px/1000px CSS and rendered one column at 439.333px. Therefore the installed build is verified, but live-host adoption is pending a Codex restart. Codex was not stopped, and no draft attachment was created during this layout check.

Previous plugin files were backed up to `artifacts/plugin-before-responsive-045-20261010` before the update.
