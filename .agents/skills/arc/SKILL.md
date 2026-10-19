---
name: arc
description: Builds and reviews React interfaces with the Arc UI library (uiarc.dev) so they match Arc's design bar, choosing the right Arc component or block, installing it with the shadcn CLI, and applying Arc's rules for tokens, type, copy, layout, motion, accessibility, and responsive behavior. Use when the user mentions Arc or uiarc, when the project contains components/arc/foundation.css (or the older registry/foundation.css) or imports from @/components/arc (or the older @/registry/components and @/registry/blocks), or when asked to build or polish UI such as a settings page, pricing section, dashboard, landing page, sign-in, form, table, chart, dialog, or command palette.
---

# Arc

Arc is a React component and block library (CSS modules, semantic CSS variables, Motion). Free items install with the shadcn CLI; Pro items are licensed. The quality bar is a calm, neutral interface where type, spacing, and one considered interaction carry the character.

## Workflow

Copy this checklist and tick it off:

```
Arc task:
- [ ] 1. Find: pick an existing Arc block or component for each region (components.md)
- [ ] 2. Install: one shadcn command for every id, foundation.css imported once
- [ ] 3. Wire: documented props only, real data, callbacks return promises
- [ ] 4. Compose: page container, spacing rhythm, states (composition.md)
- [ ] 5. Style and copy: tokens, sentence case, no eyebrows (design.md, copy.md)
- [ ] 6. Review: run checklist.md, fix, run it again until every line passes
```

**Find.** With the Arc MCP server (`https://uiarc.dev/api/mcp`): `search_components` with the user's intent, then `get_component` on the top two or three and compare `whenToUse` and `whenNotToUse`. The first connection opens a browser sign-in to an Arc account (free is enough); if a tool call fails with an auth error, ask the user to reconnect the server rather than guessing. Results mark Pro items `pro, unlocked` when the signed-in account has Pro; otherwise pass `tier: "free"`. Without MCP: read `https://uiarc.dev/llms.txt`, then `https://uiarc.dev/components/<id>/markdown`. Never rebuild an Arc item from scratch, and never reconstruct or imitate Pro source.

**Install.**

```bash
npx shadcn@latest add @uiarc/button @uiarc/input @uiarc/switch
```

This needs `{ "registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" } }` in `components.json`; without it use full URLs (`https://uiarc.dev/r/button.json`). Once per project: `import "@/components/arc/foundation.css";` in the root layout (Arc installs into an `arc/` folder under the `components` alias from `components.json`, for example `src/components/arc/`, and its files import each other with relative paths, so no `tsconfig.json` change is needed), and load Geist and Inter as `--font-geist` and `--font-inter`. Pro members install `@uiarc-pro/<id>` with a Pro token (`https://uiarc.dev/docs/ai#pro-access`).

**Wire.** Copy the import line from the item's usage example (a few use a default export, such as `segmented-control`). Selection components take `value` and `onValueChange`; pickers and editors (`date-picker`, `calendar`, `time-picker`) take `value` and `onChange`. When a callback is typed `void | Promise<…>`, return the promise: the item shows its own pending, success, and error states.

## Core principles

1. **Use Arc before writing UI.** Compose components; do not restyle their internals.
2. **One purpose per surface.** One `h1`, one primary action, one memorable detail. Remove ornamental copy and decoration.
3. **Neutral surfaces, meaningful color.** Semantic tokens only. The accent marks active, selected, and emphasized data. Status colors mean status.
4. **Hierarchy from size, spacing, and contrast.** Regular 400 and medium 500 weights only.
5. **Motion explains a change.** Shared tokens, transform and opacity, one continuous movement, reduced motion respected.
6. **Every state designed.** Empty, loading, success, error, disabled, long content, 390px, dark mode.

## Never do

- Eyebrow labels, overlines, or kicker text above headings. All caps or `text-transform: uppercase`.
- Em dashes in copy. Use a period, comma, colon, or parentheses.
- Hand-made focus rings, outlines, or halos, or any ring on pointer focus. Keyboard focus already gets Arc's subtle `:focus-visible` ring from `foundation.css`; tune it with `--focus-outline` tokens.
- Raw hex, Tailwind color classes, or arbitrary font sizes on Arc surfaces.
- Decorative gradients, glows, or colored shadows inside components. Icons inside rounded tiles.
- Nested cards, double page gutters, or a second page container inside a block.
- A toast as the only confirmation of a foreground action.
- Browser-only values (`window`, `Date.now()`, `Math.random()`, `localStorage`) in the first render.

## Quick decisions

| The user wants | Use | Not |
| --- | --- | --- |
| 2 to 5 views of the same data | `segmented-control` | `tabs` (tabs swap whole panels) |
| Peer panels of one object | `tabs` | Separate routes for each panel |
| On or off that applies now | `switch` | `checkbox` (checkbox is for forms that submit) |
| One of a few visible options | `radio-group`, or `radio-cards` with descriptions | `select` for fewer than 5 options |
| Long option list | `select`, `combobox` to search | `radio-group` |
| A decision that must interrupt | `dialog` | `drawer` |
| A long form or record detail beside the page | `drawer` | `dialog` |
| A task on phones | `bottom-sheet` | `dialog` for mobile-first tasks |
| Destructive action | `confirm-morph`, `hold-to-confirm` for irreversible | A modal for every delete |
| Records to compare | `sortable-data-table` | Hand-built tables |
| KPI row | `metric-card` | Hand-built cards |
| Result of a save | The button or row confirms in place | `toast` (background work only) |

The full catalog by job, with free and Pro ids, is in components.md.

## Reference files

Read only the file the task needs. Each is one level from here.

| File | Read it when |
| --- | --- |
| [components.md](components.md) | Choosing an item: every live id by job, overlays, inputs, data, marketing blocks |
| [composition.md](composition.md) | Laying out a page: containers, dashboards, marketing sections, states, React correctness |
| [design.md](design.md) | Tokens for color, type, surfaces, radii, spacing, icons, metallic and brand treatments |
| [copy.md](copy.md) | Writing any visible text: headings, buttons, errors, empty states, claims |
| [motion.md](motion.md) | Adding or reviewing animation |
| [accessibility.md](accessibility.md) | Semantics, keyboard, names, announcements |
| [responsive.md](responsive.md) | Widths, touch targets, overflow, tables on phones |
| [checklist.md](checklist.md) | Before you finish. Always |
| [example-settings.md](example-settings.md) | Worked example: account settings page |
| [example-pricing.md](example-pricing.md) | Worked example: pricing section with plans, comparison, and FAQ |
| [example-dashboard.md](example-dashboard.md) | Worked example: analytics overview with KPIs, chart, and table |
| [INSTRUCTIONS.md](INSTRUCTIONS.md) | Short always-on rules for AGENTS.md, CLAUDE.md, or Cursor rules |

Over MCP, `get_skill` returns any of these by file name without `.md` (`get_skill { "id": "checklist" }`). Raw copies: `https://uiarc.dev/r/skills/arc/<file>`.

## Before you finish

Run [checklist.md](checklist.md) against your diff. Fix every failing line, then run it again. Then run the project's type check and lint.
