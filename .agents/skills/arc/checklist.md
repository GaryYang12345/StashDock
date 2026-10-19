# Arc review checklist

Run this before you finish any Arc task. Copy it into your response, check each line against the code you wrote, and fix every failure. Then run it again. Stop only when every line passes or you have told the user why one cannot.

## 1. Automated sweeps

Run these over the files you changed (adjust the paths). Each hit is a fix unless it is inside a string the user supplied.

```bash
grep -rn "$(printf '\342\200\224')" app components   # em dashes in copy
grep -rniE "uppercase|eyebrow|overline|kicker" app components
grep -rnE "outline:|:focus-visible|(^|[^a-z])ring-[0-9]" app components
grep -rnE --include="*.css" "#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(" app components   # raw colors
grep -rnE "font-weight: *(600|700|800|bold)" app components
grep -rnE --include="*.css" "linear-gradient|radial-gradient" app components     # allowed only for a marketing backdrop or metallic mark
grep -rn --include="*.css" "100vw" app components
```

Then run the project's type check and lint.

## 2. Review

```
Arc review:
Type and copy
- [ ] Sentence case everywhere; no all caps, no uppercase transforms
- [ ] No eyebrow or overline text above any heading
- [ ] No em dashes; headings have no trailing period
- [ ] Only weights 400 and 500; sizes from --text-* tokens
- [ ] Buttons are verb plus object (a bare verb only where the object is named right beside it); errors say how to fix; claims are true
- [ ] Changing or aligned numbers use tabular-nums

Color and surfaces
- [ ] Only semantic tokens; no raw hex, ramp values, or Tailwind colors
- [ ] Accent only on active, selected, progress, or the emphasized data
- [ ] Status colors only for real status, always with a label
- [ ] No decorative gradients, glows, or colored shadows in components
- [ ] Third-party logos in their real brand colors
- [ ] Shadows only on floating layers; cards rest on a 1px border
- [ ] No icons in rounded tiles; no nested decorative cards

Layout
- [ ] One page container; blocks fill their column with no double gutter
- [ ] Heading, cards, and table share the same left edge
- [ ] Sibling cards align (same top and height) with a real gap or shared dividers
- [ ] Nested radii are concentric (inner = outer - padding)
- [ ] Spacing on the 4px grid: 16px inside a group, 24px between regions, 32 to 48px between sections of a long form; page padding 24 to 32px; marketing sections 64 to 120px
- [ ] Wide tables scroll inside their card

Components
- [ ] Every region uses an existing Arc item where one fits (components.md)
- [ ] The choice matches "when to use" (tabs vs segmented control, dialog vs drawer vs sheet, switch vs checkbox)
- [ ] Only documented props; no restyled internals
- [ ] One primary button per surface (a `button` without `variant` renders primary)
- [ ] No Pro source reconstructed

States
- [ ] Loading (skeleton in final layout), empty (one next step), error (inline, with retry), success (in place), disabled (explained)
- [ ] Long names and values wrap or truncate with the full value reachable

Motion
- [ ] Tokens from components/arc/lib/motion-tokens; no hand-tuned durations without reason
- [ ] Only transform and opacity animate (size only on a spring when it is the information)
- [ ] State indicators land without overshoot; bounce only for playful moments
- [ ] One continuous movement per interaction; exits faster than entrances
- [ ] A reduced motion branch for every animation

React correctness
- [ ] First render is server-safe: no window, localStorage, Date.now, Math.random, or locale-dependent output
- [ ] Animated elements keep stable keys and are not remounted on state change
- [ ] Changing values reserve their width; nothing jumps

Accessibility
- [ ] No focus rings on pointer focus and no hand-made rings; keyboard focus shows Arc's shared `:focus-visible` ring (tune with `--focus-outline` tokens)
- [ ] Real buttons, links, labels, headings in order, landmarks
- [ ] Icon-only controls have specific names
- [ ] Overlays trap and return focus and close on Escape
- [ ] State never shown by color alone; async status announced

Responsive
- [ ] Checked at 390, 768, 1024, 1440 (if you cannot render, read the CSS for fixed widths, missing min-width: 0, and unwrapped rows); no sideways page scroll
- [ ] Touch targets at least 44px; hover content reachable by tap or focus
- [ ] Both themes and two accents (neutral and one hue) read correctly
```

## 3. Report

Tell the user what you built, which Arc items you used, what is simulated or still needs real data, and any checklist line you could not satisfy and why.
