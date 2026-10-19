# Arc design

The visual rules for anything built with or next to Arc components. Every token below is defined in `components/arc/foundation.css`.

## Contents
- Color
- Brand, metallic, and logo treatments
- Type
- Surfaces, borders, and shadows
- Radii (concentric corners)
- Spacing and sizing
- Icons
- Themes and accents

## Color

Components and pages use semantic roles only. Never the `--neutral-*` ramp, raw hex, or Tailwind color classes.

| Role | Tokens |
| --- | --- |
| Page and surfaces | `--background`, `--surface`, `--surface-raised`, `--surface-muted` |
| Text | `--foreground`, `--text-secondary`, `--text-muted` |
| Lines | `--border` (default), `--border-subtle` (inside a surface), `--border-strong` (inputs, emphasis) |
| Accent | `--accent`, `--accent-strong`, `--accent-subtle`, `--accent-foreground` |
| Status | `--success`, `--warning`, `--danger` (and `--accent` for info) |
| Selection controls | `--control-on`, `--control-glyph`, `--control-track`, `--control-thumb`, `--control-thumb-on` |
| Chart series | `--series-1` to `--series-4` |

**Accent with intent.** Most of the screen stays neutral. Spend `--accent` on: the active nav item, a selected row or option, the one data series that matters, progress, and a few interaction details (a link, a count that just changed). Tint with `--accent-subtle` behind accent text or icons. Do not color headings, card backgrounds, or every icon with it.

**Status means status.** `--success`, `--warning`, and `--danger` appear only when something succeeded, needs attention, or failed. `badge` `tone="info"` uses the accent and may mark emphasis ("Recommended", "New"); the other tones are for status only. Put most of the color on the icon with a faint tint behind it, and always pair it with a short label. Never use green for "nice" or red for "important".

**Selection controls** that you build yourself use the `--control-*` tokens, not `--accent` with `--accent-foreground`. They are tuned per accent so a thumb always reads against its track.

## Brand, metallic, and logo treatments

- **Third-party logos use their real brand colors** (the multicolor Google G, Slack, Stripe purple). A grey logo row looks like placeholder content. Brand marks are sample content, never implied endorsements.
- **The Arc brand gradient** (`--arc-gradient`, `--arc-gradient-soft`) is only a subtle backdrop behind a marketing section. Never inside a component, on a button, on text in product UI, or on a card surface.
- **Metallic surfaces** are an allowed premium treatment for one element per view: a Pro plan card, an avatar fallback, a premium badge. Brushed silver in light, graphite in dark, near-zero chroma, a hairline edge, text contrast checked in both themes. Define the values locally and redefine them for dark mode:

```css
.premium {
  --metal-plate: linear-gradient(112deg, oklch(93.4% .003 260), oklch(98.6% .002 260) 24%, oklch(91.2% .004 260) 50%, oklch(96.8% .003 260) 74%, oklch(92.6% .004 260));
  --metal-edge: inset 0 0 0 1px oklch(0% 0 0 / .075), inset 0 1px 0 oklch(100% 0 0 / .95);
  --metal-ink: oklch(26% .012 260);
  background: var(--metal-plate);
  box-shadow: var(--metal-edge);
  color: var(--metal-ink);
}
:root[data-theme="dark"] .premium {
  --metal-plate: linear-gradient(112deg, oklch(24.5% .004 260), oklch(30.5% .005 260) 24%, oklch(22.5% .004 260) 50%, oklch(28.5% .005 260) 74%, oklch(24% .004 260));
  --metal-edge: inset 0 0 0 1px oklch(100% 0 0 / .09), inset 0 1px 0 oklch(100% 0 0 / .06);
  --metal-ink: oklch(95.5% .004 260);
}
```

## Type

| Face | Token | Use | Settings |
| --- | --- | --- | --- |
| Geist | `--font-display` | Headings 30px and up | 400 or 500, `letter-spacing: var(--tracking-display)` (-0.03em), `line-height: var(--leading-display)` (1.1) |
| Inter | `--font-body` | Body, labels, controls, small headings | 400 or 500, `letter-spacing: var(--tracking-body)` (-0.01em), `line-height: var(--leading-body)` (1.4) |

- Sizes come from the scale only: `--text-xs` 12, `--text-sm` 14, `--text-base` 16, `--text-lg` 18, `--text-xl` 22, `--text-2xl` 28, `--text-3xl` 36, `--text-4xl` 52, `--text-5xl` 72.
- Weights are 400 and 500. Never 600 or bold. Hierarchy comes from size, color (`--foreground` over `--text-secondary`), and spacing.
- Keep Geist out of controls and small labels; keep Inter out of hero headlines.
- Numbers that change or align in columns use `font-variant-numeric: tabular-nums`.
- No `text-transform: uppercase`, no wide letter-spacing on small labels, no eyebrow line above a heading. See copy.md.

## Surfaces, borders, and shadows

- Group with proximity first, a one pixel `--border` second, a card only for a real boundary.
- Shadows only on layers that float: menus, popovers, dialogs, sheets (`--shadow-floating`). Cards rest on a border with no shadow. `--shadow-resting` and `--shadow-raised` exist for the rare lifted element; never stack them.
- No nested rounded cards, decorative pills, glows, or scattered symbols.
- Sibling cards share edges: cards in a row have the same top, the same height (`align-items: stretch`), and their outer edges sit flush with the content column. Either separate them with a real gap (16 to 24px) or join them into one bordered group with hairline dividers. Never a 1 to 4px gap where two borders nearly touch.

## Radii (concentric corners)

`--radius-control` 18px (inputs, buttons), `--radius-panel` 26px (menus, nested panels), `--radius-surface` 34px (cards, large surfaces), `--radius-pill` (tags, status marks).

A nested corner is the outer radius minus the padding between them, so the curves stay parallel:

```css
/* Correct: inner = outer - padding */
.card  { border-radius: var(--radius-surface); padding: 8px; }
.inner { border-radius: calc(var(--radius-surface) - 8px); } /* 26px, same as --radius-panel */

.panel { border-radius: var(--radius-surface); padding: 24px; }
.panel > .media { border-radius: calc(var(--radius-surface) - 24px); } /* 10px */
```

```css
/* Incorrect: the same radius inside and out makes a thick, uneven corner */
.card  { border-radius: 34px; padding: 16px; }
.inner { border-radius: 34px; }
```

Clamp the result at a small positive value (`max(6px, calc(...))`) when padding is large.

## Spacing and sizing

- A 4px grid: 4, 8, 12, 16, 24, 32, then 48, 64, 96, 120 for sections. Tokens are `--space-N` = N × 4px for N = 1 to 6, 8, 10, 12, 16, 20, 24 (no `--space-7`, `--space-9`, and so on).
- Controls: `--control-height-sm` 36px, `--control-height-md` 44px (default for anything tapped on phones), `--control-height-lg` 50px.
- Rhythm by context (details in composition.md): product pages use 16px inside groups, 24px between regions, 32 to 48px between long-form sections, and 24 to 32px page padding; marketing sections use 64 to 120px vertical padding.
- Internal control spacing stays fixed as the viewport grows; only outer gutters grow.

## Icons

- `lucide-react` at 16, 20, or 24px with `strokeWidth={1.75}`. Decorative icons get `aria-hidden="true"`.
- A plain icon beside its label. No icon inside a rounded tile or circle unless the shape is the control itself or carries a status.
- Use a text label when it is clearer than an icon, especially for destructive or unfamiliar actions.

## Themes and accents

- Dark mode is `data-theme="dark"` on `<html>`; the accent is `data-accent` (`neutral`, `violet`, `blue`, `green`, `amber`, `orange`, `coral`, `rose`). Every token already has a dark value, so tokens alone make a screen work in both themes.
- Check both themes and at least two accents (neutral and one saturated hue). A screen that only works in neutral is using the accent wrong.
