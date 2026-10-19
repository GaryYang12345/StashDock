# Responsive Arc

Arc components fit their container. Your page layout decides the widths.

## Widths to check

Render at **390, 768, 1024, and 1440px** (and 320px for anything with long labels or tables). At every width:

- No sideways page scroll. The only horizontal scrollers are code blocks, wide tables, and segmented rows, each inside its own container.
- Nothing is clipped, overlapped, or cut mid-word.
- The primary action is visible without hunting.

## Layout

- Gutters are 16px on phones and grow with width (`padding-inline: clamp(16px, 4vw, 32px)`). Internal control spacing stays fixed.
- Collapse multi-column layouts to one column below about 800px. Settings rows stack label above control below about 560px.
- Grid and flex children get `min-width: 0`; user content gets `overflow-wrap: anywhere`.
- Never `width: 100vw` inside the page (it includes the scrollbar). Use `width: 100%`.
- Reading measure stays near 65 characters (`max-width: 65ch` on long text).
- Prefer container queries for component-level changes and media queries for page layout.

## Tables and charts

- Wide tables scroll inside their card (`overflow-x: auto` on a wrapper inside the bordered card), or switch to a stacked list on phones. The page itself never scrolls sideways.
- `comparison-table` stacks into two columns below `stackBelow` (640px by default) and keeps a sticky header offset by `stickyTop`.
- Charts (`line-chart`, `bar-chart`, `sparkline`, `activity-heatmap`) follow their container width. Set height with the `height` prop when there is one.

## Touch

- Hit targets are at least 44px tall on touch (`--control-height-md`). Keep at least 8px between adjacent targets.
- Hover is an enhancement. Anything shown on hover (`hover-card`, `tooltip`, row actions) is also reachable by tap or focus.
- Gestures (`swipe-actions`, `bottom-sheet`) always have a button path.
- On phones, prefer `bottom-sheet` for tasks and long menus; keep `popover` for small choices. `user-menu` already opens as a sheet on phones.

## Type

- Hero and section headings scale with `clamp()` between two steps of the scale, for example `font-size: clamp(var(--text-3xl), 5vw, var(--text-5xl))`.
- Body text stays at `--text-base` or `--text-sm`. Nothing below `--text-xs`.

## Before placing a component

Each item's markdown has a "Responsive behavior" section (`https://uiarc.dev/components/<id>/markdown`). Read it before putting the item in a narrow column, and pass its props (such as `stackBelow` or `stickyTop`) instead of wrapping it in your own media queries.
