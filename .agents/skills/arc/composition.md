# Composing pages with Arc

Arc components own their internals; your CSS module owns the layout.

## Contents
- Plan the page
- One page container
- Product pages and dashboards
- Marketing pages
- States
- React correctness
- Page recipes

## Plan the page

Write three lines before you choose anything:

```
Job: what the person comes here to do ("change their plan and see what it costs")
Primary action: exactly one ("Upgrade to Team")
Regions: each region and the Arc item it uses (components.md)
```

Hierarchy: one `h1`; section headings describe content; the primary action is the only primary `button` on screen (`button` defaults to primary, so set `variant` on every other one); secondary actions go in `split-button` or `dropdown-menu`.

## One page container

An app has one page container that sets the max width and the gutters, usually in the app layout. Everything inside fills its column. Blocks and cards never add their own page gutter. A page may narrow its reading column with `max-width` alone (settings and forms at 640 to 720px), never with extra padding.

```css
/* Correct: one container, children fill it */
.page {
  width: 100%;
  max-width: 1200px;
  margin-inline: auto;
  padding: 32px clamp(16px, 4vw, 32px);
  display: grid;
  gap: 24px;
}
.page > * { min-width: 0; }
```

```tsx
// Incorrect: a second container inside the page doubles the gutter
<main className={styles.page}>
  <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px" }}>...</section>
</main>
```

Checks:
- The left edge of the heading, the first card, and the table line up.
- An embedded block fills its column edge to edge; if the block ships with outer padding for its demo, remove it rather than stacking it on yours.
- Grid and flex children get `min-width: 0` so long content cannot push the page sideways.

## Product pages and dashboards

- Page padding 24 to 32px (16px on phones). 16px between related cards and fields, 24px between regions, 32 to 48px between the sections of a long settings or form page.
- Content widths: forms and settings read best at 640 to 720px; dashboards and tables use the full container.
- A KPI row is a grid of `metric-card`s with equal heights: `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`.
- Sibling cards share edges: same top and height, outer edges flush with the column. See design.md.
- Wide tables scroll inside their card, never the page:

```css
.tableCard { border: 1px solid var(--border); border-radius: var(--radius-surface); overflow: hidden; }
.tableScroll { overflow-x: auto; overscroll-behavior-x: contain; }
```

- Settings: a list of rows (label and description on the left, control on the right) inside one bordered group per section, with `--border-subtle` dividers. Do not wrap each row in its own card.

```tsx
// Correct: one group, divided rows
<section aria-labelledby="notifications">
  <h2 id="notifications">Notifications</h2>
  <div className={styles.group}>
    <div className={styles.row}><span id="updates">Product updates</span><Switch aria-labelledby="updates" /></div>
    <div className={styles.row}><span id="summary">Weekly summary</span><Switch aria-labelledby="summary" /></div>
  </div>
</section>

// Incorrect: a card per row, an eyebrow, and a second heading level for nothing
<p className="eyebrow">PREFERENCES</p>
<Card title="Product updates"><Switch /></Card>
<Card title="Weekly summary"><Switch /></Card>
```

## Marketing pages

- Sections breathe: 64 to 120px vertical padding (64px on phones), same container and gutters as the rest of the page.
- One idea per section. Do not repeat the same card grid or split layout in consecutive sections.
- Default order: `site-header`, `hero-section`, proof (`logo-marquee` with real brand colors, `stats-band` with true numbers), features, pricing (see example-pricing.md), `faq-section`, `cta-section`, `site-footer`.
- Headings are Geist at `--text-3xl` to `--text-5xl`, weight 400 or 500, with no eyebrow above them.
- The brand gradient (`--arc-gradient-soft`) may sit behind one section as a subtle backdrop. Nothing else is gradient.
- One entrance animation per page at most (`in-view-title` on the hero or first heading). No slide-up on every section.

## States

Design every data region for all of them before you finish:

| State | Treatment |
| --- | --- |
| Loading | `skeleton` in the final layout, same dimensions, `aria-busy` on the region |
| Empty | `empty-state` with why it is empty and one next step |
| Error | Inline `alert` next to the cause, with a retry |
| Success | Confirm in place: the button label, the row, the value |
| Disabled | Explain why nearby, or hide the control. A save button disabled until something changes needs no explanation |
| Long content | Wrap or truncate with the full value reachable |

## React correctness

- **Server-safe first render.** The first render must match on server and client. Read `window`, `matchMedia`, `localStorage`, `Date.now()`, `Math.random()`, and the user's locale or time zone in an effect or with `useSyncExternalStore` and a server snapshot. Format dates with an explicit locale and `timeZone`.

```tsx
// Incorrect: differs between server and client
const [theme] = useState(localStorage.getItem("theme") ?? "light");

// Correct: the server snapshot ("light") is also the first client render, then it syncs
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};
const theme = useSyncExternalStore(subscribe, () => localStorage.getItem("theme") ?? "light", () => "light");
```

- **Do not remount animated elements.** Keep `key` stable on anything that animates, never define a component inside another component's render, and never swap the element type of an animated node on state change. A remount restarts the animation and loses focus.
- **Stable dimensions.** Reserve space for values that change (tabular numerals, fixed min widths) so neighbours do not jump.
- Add `"use client"` only to files that use state, effects, or event handlers; keep the page shell a server component when the framework supports it.

## Page recipes

Free items unless marked Pro. Full worked code: example-settings.md, example-pricing.md, example-dashboard.md.

| Page | Build it from |
| --- | --- |
| Sign in and sign up | `sign-in` or `login-centered`, then `signup-form`, `otp-input`. Pro: `login-split`, `login-immersive` |
| Dashboard | `h1` and `segmented-control` for range, `metric-card` row, `line-chart` or `bar-chart`, `sortable-data-table`. Pro: `metrics-dashboard`, `metric-explorer` |
| Settings | Sections of `input`, `select`, `switch` rows, a save `button`, `confirm-morph` for deleting. Pro: `settings-page`, `security-settings` |
| Record list | `filter-toolbar` or `search-field`, `sortable-data-table`, `pagination`, `empty-state`. Pro: `data-grid` |
| Pricing | `billing-toggle` and `BillingPrice`, plan cards or `radio-cards`, `comparison-table`, `faq-section`. Pro: `pricing-calculator`, `usage-pricing` |
| Landing page | `site-header`, `hero-section`, `logo-marquee`, `stats-band`, `comparison-table`, `faq-section`, `cta-section`, `site-footer`. Pro: `feature-bento`, `scroll-story` |
| App shell | `command-palette`, `user-menu`, `notification-center`. Pro: `sidebar-rail`, `workspace-sidebar` |
| Not found, offline, no results | `empty-states` block, or `empty-state` inside a region |
