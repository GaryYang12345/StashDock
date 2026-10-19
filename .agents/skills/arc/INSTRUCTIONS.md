# Arc rules for coding agents

Keep this file where your agent reads project rules: paste it into `AGENTS.md` or `CLAUDE.md`, or save it as `.cursor/rules/arc.mdc` with this header:

```
---
description: Arc UI rules for React components, pages, and CSS modules
globs: ["**/*.tsx", "**/*.module.css"]
alwaysApply: false
---
```

The full skill (component choice, layout, motion, examples, review checklist) is at `https://uiarc.dev/r/skills/arc/SKILL.md`, installable with `npx shadcn@latest add https://uiarc.dev/r/arc-skill.json`.

## Always

1. Use an existing Arc component or block before writing UI. Search with the Arc MCP server (`https://uiarc.dev/api/mcp`, tools `search_components` and `get_component`; the first connection opens a browser sign-in) or `https://uiarc.dev/llms.txt`, and read `https://uiarc.dev/components/<id>/markdown` before using an item. Follow its "When not to use".
2. Use only documented props. Compose and wrap Arc components; never fork or restyle their internals, and never reconstruct Pro source.
3. One page container per app. Blocks fill their column with no second gutter or max width.
4. One `h1`, one primary button per surface (`button` defaults to `variant="primary"`, so set `secondary` or `ghost` on the rest), one memorable detail per view.
5. Semantic tokens only: `--background`, `--surface`, `--surface-muted`, `--foreground`, `--text-secondary`, `--text-muted`, `--border`, `--accent`, `--success`, `--warning`, `--danger`, `--radius-*`, `--text-*`, `--space-*`.
6. The accent marks active, selected, progress, and emphasized data. Status colors only for real status, with a label. Third-party logos in their real colors.
7. Type: Geist for headings 30px and up, Inter for the rest, weights 400 and 500 only, sizes from the scale, `tabular-nums` for changing numbers.
8. Nested corners are concentric: inner radius = outer radius - padding.
9. Motion from `@/components/arc/lib/motion-tokens`: `spring.smooth` (no overshoot) for panels and anything that reports state, `spring.snappy` for presses, `spring.morph` for shared highlights. Animate transform and opacity, one continuous movement, and a reduced motion branch for every animation.
10. First render is server-safe (no `window`, `localStorage`, `Date.now()`, or `Math.random()` output), and animated elements keep stable keys.
11. Every data region has loading (`skeleton`), empty (`empty-state`), error (inline `alert`), and in-place success states.
12. Check 390, 768, 1024, and 1440px: no sideways scroll, wide tables scroll inside their card, touch targets at least 44px.

## Never

- Eyebrow labels or overlines above headings; all caps or uppercase transforms.
- Em dashes in copy. Use a period, comma, colon, or parentheses.
- Hand-made focus rings, outlines, or halos, or any ring on pointer focus. Keyboard focus already gets Arc's subtle `:focus-visible` ring from `foundation.css`.
- Raw hex, Tailwind color classes, weights above 500, or arbitrary font sizes.
- Decorative gradients, glows, or colored shadows in components; icons in rounded tiles; nested decorative cards.
- A toast as the only confirmation of a foreground action.
- Motion that loops without meaning or replays on every scroll.
