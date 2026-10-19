# Arc motion

Motion shows cause and effect: what opened, what changed, where it came from, what is ready next. If an animation explains nothing, remove it.

## Contents
- Tokens
- Choosing a spring
- Rules
- Patterns with code
- Reduced motion

## Tokens

Import from `@/components/arc/lib/motion-tokens` (installed with the first Arc item).

| Token | Value | Use for |
| --- | --- | --- |
| `spring.smooth` | 0.4s, bounce 0 | Panels, height, drawers, progress, layout shifts. Never overshoots |
| `spring.snappy` | 0.26s, bounce 0.12 | Press feedback, small indicators, icon swaps |
| `spring.morph` | 0.42s, bounce 0.16 | Shared highlights (`layoutId`), width that follows new content, shape morphs |
| `duration.instant` / `fast` / `exit` / `standard` / `considered` | 0.12 / 0.16 / 0.18 / 0.24 / 0.48s | Tweens for color, opacity, and small fades |
| `ease.enter`, `ease.exit`, `ease.standard`, `ease.inOut` | cubic-bezier arrays | Entrances, exits, color changes, on-screen moves |
| `stagger.item` / `line` / `word` / `char` | 0.035 / 0.08 / 0.04 / 0.016s | Lists and text, total under about 0.4s |
| `blur.subtle` / `soft` / `text` | 2 / 4 / 8px | Brief crossfades only |

CSS transitions use the matching variables: `var(--duration-fast)` with `var(--ease-standard)` for color and opacity, `var(--duration-spring)` (580ms) with `var(--ease-spring)` for transforms. CSS has `--duration-instant`, `-fast`, `-standard`, `-considered`, and `-spring`; there is no `--duration-exit`.

## Choosing a spring

- **Anything that reports state lands without overshoot**: a switch thumb, a drawer edge, a panel height, a progress fill, a value. Use `spring.smooth` (or another `bounce: 0` spring). An overshoot there briefly shows a state that is not true.
- **Small life is for feedback**: `spring.snappy` on a press, `spring.morph` for a selection highlight gliding between options.
- **Visible bounce is for playful moments only**: a reaction, a celebration, a physics toy. Never on routine product UI.

## Rules

1. Animate `transform` and `opacity` (and brief `filter: blur`). Animate `width` or `height` only when the size change is the information, and then on a spring.
2. **One continuous gesture per interaction.** A state change is one spatial movement, not a fade, then a slide, then a scale on separate timings.
3. Everything is interruptible: use springs for anything the user can reverse, so reversing mid-way never jumps.
4. Nothing resizes in one frame. Animate the size or reserve the space.
5. Numbers count to their new value with `font-variant-numeric: tabular-nums` and a stable width (`animated-counter`, `BillingPrice`).
6. Presses scale to about 0.97, except an element that anchors a popover or menu: answer that press with color, because the popup positions against the pressed size.
7. Exits are faster than entrances (`duration.exit`, `ease.exit`).
8. One orchestrated entrance per page at most. No scroll reveal on every section, no loops unless they show live status.
9. Keep the animated element mounted. Changing its `key` or conditionally swapping its component restarts the animation (see composition.md).

## Patterns with code

Selected highlight that glides between options (what `segmented-control` and `tabs` do):

```tsx
import { motion, useReducedMotion } from "motion/react";
import { motionTokens } from "@/components/arc/lib/motion-tokens";

const reduce = useReducedMotion();
{options.map(option => (
  <button key={option.value} onClick={() => setValue(option.value)} aria-pressed={value === option.value}>
    {value === option.value && (
      <motion.span layoutId="view-highlight" className={styles.highlight}
        transition={reduce ? { duration: 0 } : motionTokens.spring.morph} aria-hidden="true" />
    )}
    <span className={styles.label}>{option.label}</span>
  </button>
))}
```

Panel that opens with height and opacity together, no overshoot:

```tsx
<AnimatePresence initial={false}>
  {open && (
    <motion.div key="details"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.exit] } }}
      transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}
      style={{ overflow: "hidden" }}>
      {children}
    </motion.div>
  )}
</AnimatePresence>
```

Hover and press in CSS:

```css
.row { transition: background-color var(--duration-fast) var(--ease-standard); }
.row:hover, .row[data-selected] { background: var(--surface-muted); }
.press { transition: transform var(--duration-spring) var(--ease-spring); }
.press:active { transform: scale(.97); }
@media (prefers-reduced-motion: reduce) { .press, .row { transition: none; } }
```

Save confirmation in place: pass the promise to the Arc item (`onConfirm`, `onSave`) or set `loading` on `button`, then change its label to "Saved". Do not add a toast for a foreground action.

## Reduced motion

Every animation has a branch:

```tsx
const reduce = useReducedMotion();
<motion.div transition={reduce ? { duration: 0 } : motionTokens.spring.smooth} />
```

Keep the final state, focus, and feedback. Remove travel, loops, parallax, and autoplay. A counter jumps straight to its value; a panel appears at full height.
