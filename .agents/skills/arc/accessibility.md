# Arc accessibility

Arc components ship with their semantics and keyboard behavior. Keep them intact when you compose.

## Focus: none for the pointer, a subtle ring for the keyboard

Arc draws no focus ring on pointer focus (a mouse click or tap). Keyboard focus (`:focus-visible`) gets one subtle ring from `foundation.css`: a 2px softened accent outline with a 2px offset, the same on every component. Text fields show focus with their border and caret instead, and menu items and listbox options with their highlight fill.

Do not write your own outlines, ring `box-shadow`s, or halos. Tune the shared ring with tokens, on `:root` or on one element:

```css
/* Correct: adjust the shared keyboard ring */
.tab { --focus-outline-offset: -2px; }          /* inside a container that clips */
:root { --focus-outline: var(--accent); }       /* a stronger ring for the whole app */

/* Correct: highlighted items in composite widgets look like the hovered one */
.item:hover, .item[data-highlighted] { background: var(--surface-muted); }

/* Incorrect: a hand-made ring, or one that also shows on mouse clicks */
.item:focus { outline: 2px solid var(--accent); }
.item:focus-visible { box-shadow: 0 0 0 3px var(--accent); }
```

Radix-based Arc menus, selects, and lists already set `data-highlighted` on the active item. Keep focus order logical so people can follow it.

## Semantics

- Buttons do things, links go places. Never `onClick` on a `div` or `span`.
- Every field has a visible label (Arc's `label` prop). Use `aria-label` only where the context makes the label visually obvious (a search field in a toolbar).
- Icon-only controls have a specific name: "Delete invoice", not "Delete".
- A `switch` in a settings row with its own title and description points at them: `aria-labelledby` on the title id, `aria-describedby` on the description id (see example-settings.md). Use the `label` prop only when the switch stands alone.
- One `h1` per page, headings in order, landmarks (`header`, `nav`, `main`, `footer`) around page regions. A `section` with a heading gets `aria-labelledby`.
- Lists are lists; tables of data are tables (`sortable-data-table` already is).
- Decorative icons and images: `aria-hidden="true"` or `alt=""`. Meaningful images: alt text that says what matters.

## Keyboard

- Everything clickable is reachable with Tab and works with Enter or Space.
- Composite widgets (tabs, radio group, segmented control, menus, listboxes) have one Tab stop and arrow keys inside.
- Dialogs, drawers, sheets, and popovers move focus in, keep it there, close on Escape, and return focus to the trigger. Arc's overlays do this; do not rebuild them.
- Gestures (swipe, drag, long press, hold) always have a button or menu path.
- Keyboard shortcuts do not steal keys from text fields.

## Feedback and announcements

- Errors are tied to their field (Arc's `error` prop, or `aria-describedby`) and say how to fix the problem.
- Status that changes without user focus (saving, syncing, streaming) is announced with `role="status"` or `aria-live="polite"`. Blocking errors use `role="alert"`.
- Never encode state with color alone: pair color with a label, icon, or text.
- Loading regions set `aria-busy="true"` and keep focus where it was.

## Contrast

- Text 4.5:1 (3:1 at 24px and up, or 18.5px medium). Icons and control borders 3:1. Check both themes, including `--text-muted` on `--surface-muted` and disabled text.
- Metallic or tinted surfaces: check the ink color against the lightest and darkest stop of the gradient.

## Check

Tab through the whole screen without a mouse: you can always tell where you are from the fills, every overlay opens and closes by keyboard, and focus returns. Then turn on reduced motion and a screen reader rotor (headings, landmarks, form controls) and confirm the structure reads correctly.
