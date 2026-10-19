# Choosing Arc components and blocks

Pick the item whose job matches, not the one that looks closest. Ids below are the install names (`npx shadcn@latest add @uiarc/<id>`). Items marked Pro need Arc Pro (a Pro account signed in to the MCP server, or a Pro token); offer the free pick otherwise. Only ids listed here or returned by `search_components` exist; do not guess others.

## Contents
- How to decide
- Actions and menus
- Inputs and forms
- Overlays and disclosure
- Feedback and status
- Data display and charts
- Text and motion
- App blocks
- Marketing blocks
- Wiring rules

## How to decide

1. Name the job in one line ("pick one of three plans", "confirm deleting a project").
2. Find candidates in the tables below or with `search_components`.
3. Read each candidate's markdown (`https://uiarc.dev/components/<id>/markdown` or `get_component`). "When not to use" names the better alternative; follow it.
4. Prefer a block for a whole region, a component for a single control. Replace block sample data; do not keep placeholder names or numbers.
5. Use the same item for the same job everywhere in the app: one confirmation pattern, one menu, one table.

## Actions and menus

| Job | Pick | Instead of |
| --- | --- | --- |
| The main action on a surface | `button` (its default `variant` is `"primary"`), once per surface | Several primary buttons |
| Other actions | `button` with `variant="secondary"` or `"ghost"` set explicitly | A bare `<Button>`, which renders primary |
| Dense toolbar action | `action-button` | Full buttons in a toolbar |
| Main action plus alternatives | `split-button` | A row of equal buttons |
| Navigate somewhere | A link (`<a>` or your router's `Link`), or a block action with `href` (`hero-section`, `cta-section`) | `button` with a router push |
| A list of actions on a trigger | `dropdown-menu` | Custom popovers |
| Actions on a right-click or long press | `context-menu` | Hidden gestures without a menu |
| Copy a value | `copy-button` | A button plus a toast |
| Label that changes with state | `button` (new children crossfade in place); `text-morph` outside a button | Swapping two buttons |
| Global search and commands | `command-palette` | A search field in every page |
| Account, theme, sign out | `user-menu` | A custom avatar menu |
| Hierarchy and paging | `breadcrumb`, `pagination` | |
| Light and dark switch | `theme-switch` | |

## Inputs and forms

| Job | Pick | Instead of |
| --- | --- | --- |
| Text | `input`, `textarea`; `mention-input` for @people and #channels | Unlabeled fields |
| Search inside a page | `search-field`; `expanding-search` in a tight header | |
| Password | `password-field`, plus `password-strength` on sign up | |
| Numbers, phone | `number-field`, `phone-input` | Plain `input type="number"` |
| One of 2 to 5 visible options in a form | `radio-group` | `select` |
| Options with a price, meta, or longer description | `radio-cards` | Clickable cards you build |
| One of many options | `select`; `combobox` to type and filter | `radio-group` |
| Several values | `multi-select`, `tag-input`, `chip-group` for filter facets | Checkbox lists in a popover |
| On or off that applies immediately | `switch` | `checkbox` |
| Agree, include, or a checklist inside a submitted form | `checkbox` | `switch` |
| View mode of the same content (2 to 5) | `segmented-control` | `tabs` |
| Range or level | `slider` | Two number fields |
| Date, date range, time | `date-picker`, `date-range-picker`, `time-picker` | `calendar` (inline grid only) |
| Color | `color-picker` | |
| Files | `file-dropzone` (target), `file-upload` (full flow with progress) | |
| Verification code | `otp-input` | Six inputs you wire yourself |
| Rich text | `rich-text-editor` | A textarea with markdown hints |
| Signature | `signature-pad` | A canvas you wire yourself |
| Keyboard shortcut | `shortcut-recorder` | A text field for key names |
| Rename in place | `inline-edit` | A dialog for one field |
| A flow in steps | `stepper` with your fields; Pro: `multi-step-form` | |
| Billing period | `billing-toggle` (with `BillingPrice`) | A segmented control plus hand-rolled prices |

## Overlays and disclosure

| Job | Pick | Instead of |
| --- | --- | --- |
| A decision that must interrupt, or a short form | `dialog` | `drawer` |
| A long form, filters, or record detail beside the page | `drawer` | `dialog` |
| Mobile-first secondary task with snap heights | `bottom-sheet` | `dialog` on phones |
| Small anchored controls without dimming the page | `popover` | `dialog` |
| One-line hint for an unfamiliar control | `tooltip` | Essential information (tooltips hide it) |
| Preview of a person or link | `hover-card` (also opens on focus) | |
| Peer panels of one object (Overview, Activity, Settings) | `tabs` | `segmented-control` |
| Stacked sections read in order, FAQ | `accordion` | `tabs` |
| A card that needs more room on request | `expandable-card` | Navigating away |
| Two panes that trade space | `resizable-panels` | |
| Long content in a fixed box | `scroll-area` | `overflow: auto` with default bars |

## Feedback and status

| Job | Pick | Instead of |
| --- | --- | --- |
| Confirm a foreground action | In place: `button` `loading`, then its label | `toast` |
| Destructive action | `confirm-morph`; `hold-to-confirm` when an accidental tap must be nearly impossible; `dialog` when the consequence needs explaining | A modal for every delete |
| Result of background work | `toast`, `toast-stack` for several | Inline banners that shift layout |
| A message that stays until resolved | `alert` with `tone` | `toast` |
| Status label | `badge` with `tone` | Colored text alone |
| Known progress | `progress`, `stepper` for steps | A spinner |
| Loading | `skeleton` in the final layout | A page spinner |
| Nothing to show yet | `empty-state` with one action | "No data" |
| Quota or allowance | `usage-meter` | A bare progress bar |
| Site-wide notice | `announcement-bar` | A banner you build |
| People | `avatar`, `avatar-group` | Initials you draw |

## Data display and charts

| Job | Pick | Instead of |
| --- | --- | --- |
| Headline number (KPI) | `metric-card` (label, number, context line, change chip) | Hand-built KPI cards |
| Number that changes | `animated-counter` | Text that jumps |
| Records to sort and compare | `sortable-data-table`; Pro: `data-grid` for spreadsheet editing | Div grids |
| Filters above a collection | `filter-toolbar` | Loose selects |
| Trend over time | `line-chart`; `sparkline` beside a value | |
| Compare one measure across categories or days | `bar-chart` | A line chart for categories |
| Share of a whole (up to about 5 parts) | `donut-chart`; `waffle-chart` for percentages; `treemap` for a hierarchy | A pie with many slices |
| Dense time series to zoom into | `brush-chart` | A line chart with hundreds of ticks |
| Before and after across items | `slope-chart` | Two bar charts |
| Distributions by group | `ridgeline` | |
| Layered totals over time | `streamgraph` | |
| Value against a range | `gauge` | |
| A year of daily activity | `activity-heatmap` | |
| Events, newest first | `timeline` | |
| Nested structure | `tree-view` | |
| Code or JSON | `code-block`, `json-viewer` | `<pre>` |
| Comments and chat | `comment-thread`, `chat-thread` | |
| Feature comparison across plans or products | `comparison-table` (block) | A hand-built table |
| A row of slides | `carousel` | |
| Before and after images | `image-compare` | |
| Row actions on touch | `swipe-actions` (always with a menu path) | Swipe only |

Pro charts: `funnel-chart`, `radar-chart`, `sunburst`, `sankey-flow`, `race-bar-chart`, `realtime-stream`, `activity-rings`.

## Text and motion

Use one text effect per page, where it explains something.

| Job | Pick |
| --- | --- |
| A title entering as it scrolls into view (once) | `in-view-title` |
| A short reveal on load | `text-reveal` |
| A label that changes to its next state | `text-morph` |
| Ongoing work ("Generating") | `text-shimmer` |
| Numbers or short text spinning to a new value | `slot-text` |

## App blocks

Free: `command-palette`, `notification-center`, `file-upload`, `otp-input`, `page-header`, `empty-states` (no results, offline, missing page), `sign-in` (email code card), `login-centered` (passkey card), `signup-form`.

Pro, by job:

| Job | Pro blocks |
| --- | --- |
| App shell | `sidebar-rail`, `workspace-sidebar`, `inbox-sidebar`, `docs-sidebar` |
| Sign in, full screen | `login-split`, `login-immersive` |
| Settings and account | `settings-page`, `security-settings`, `roles-permissions`, `api-keys`, `webhooks`, `integrations` |
| Billing | `billing-overview`, `usage-billing`, `usage-forecast`, `invoice-studio`, `cancel-flow`, `checkout-summary` |
| Team | `team-members`, `invite-people`, `team-directory` |
| Analytics | `metrics-dashboard`, `metric-explorer`, `revenue-explorer`, `cohort-retention`, `mrr-waterfall`, `journey-flow`, `kpi-drilldown` |
| Boards | `project-board` |
| Setup flows | `multi-step-form`, `release-readiness` |
| AI | `ai-chat`, `ai-composer`, `agent-run` |
| Support and inbox | `support-widget`, `support-conversation`, `inbox-triage` |
| Commerce | `product-listing`, `product-detail`, `cart-drawer` |
| Scheduling and media | `week-calendar`, `availability-picker`, `media-player` |

## Marketing blocks

Free: `site-header`, `hero-section`, `logo-marquee`, `stats-band`, `plan-comparison`, `comparison-table`, `faq-section`, `cta-section`, `newsletter-signup`, `contact-section`, `blog-grid`, `changelog-feed`, `site-footer`.

Pro: `hero-signup`, `feature-bento`, `scroll-story`, `spotlight-grid`, `testimonial-stage`, `team-showcase`, `pricing-calculator`, `usage-pricing`.

Notes:
- `plan-comparison` is a finished two-plan demo with its own billing switch and sample data. For your own plans, compose `billing-toggle`, your plan cards (or `radio-cards`), and `comparison-table` (see example-pricing.md).
- Blocks with props (`hero-section`, `cta-section`, `faq-section`, `stats-band`, `comparison-table`, `site-header`) take your content directly. Blocks without props (`page-header`, `plan-comparison`) are starting points: edit their data in the installed file.

## Wiring rules

- Copy the import from the usage example: `import { Button } from "@/components/arc/button/button";`, `import SegmentedControl from "@/components/arc/segmented-control/segmented-control";`, blocks from `@/components/arc/blocks/<id>/<id>`.
- Use only documented props. Where an item accepts `className` or native props (check its props table), use them for layout (margin, grid placement), never to restyle internals.
- Pick controlled (`value` plus a change handler) or uncontrolled (`defaultValue`), not both.
- Async callbacks (`onConfirm`, `onSubmit`, `onSave`) return the promise; reject to show the item's error state. Do not add a second spinner.
- Wrap an Arc component to add behavior; do not fork its source.
