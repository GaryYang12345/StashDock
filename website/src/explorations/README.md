# Hero art direction study

## Interactive layout editor

Open `/hero-editor.html` to drag individual cards and adjust centre-relative X,
canvas-relative Y, uniform scale, rotation and stacking order. The inspector can
also be moved or hidden. Disable the fade preview to reach cards below its mask.
Fade start, transition height (both in canvas-relative CSS pixels) and strength
(0 to 100%) are adjustable and exported under `fade`. Optional horizontal guides
mark the start and end. Full strength reaches complete transparency at the end;
zero strength keeps the composition opaque. Earlier exports without `fade`
retain all card values and acquire the previous default fade on import.
The first card is now Anti-Defensive Writing with a generated editorial cover.
Earlier drafts referring to `arc-ui` transfer that slot's geometry and layer to
`anti-defensive`; no other positions or fade parameters change.
Arrow keys nudge by one CSS pixel; Shift nudges by ten. Undo and Reset are local
to this editor. The draft is stored under `stashdock-hero-layout-editor-v1` in
this browser only, not in the library or production configuration.

Copy layout or Download JSON exports all eight stable reference IDs and the
current artwork canvas dimensions. Send that JSON back for implementation; a
screenshot is optional. Import JSON restores a validated export. Values use a
300px unscaled card width; X refers to its centre relative to the artwork centre,
Y to its unscaled top. Rotation and uniform scale share the centre origin.
The editor is an independent development entry, absent from the production build.

## Original comparison

Open `/hero-concepts.html` on the website development server. The comparison
uses the real `Hero`, `Nav`, Arc segmented control, product card styles and
curated public demo assets. It does not access a local library.

- Original: current hero without additional artwork.
- A: two asymmetric clusters of context cards, dissolving toward the edges.
- B: a single fan of references emerging from the bottom edge.
- C: a lighter index of covers and source names beneath the primary actions.

Artwork is decorative, non-interactive and excluded from the accessibility tree.
Only opacity transitions between options; reduced motion removes that transition.
The selectors are review tools, not proposed production controls.

This is a separate development HTML entry. It is not imported by `App`, and the
existing single-entry website production build does not include its controls.
A is now implemented by the shared `HeroReferences` illustration used in the
production hero. The study's Original option disables it for comparison; B and C
remain exploratory only. Production headline content, typography and animations
remain unchanged. Narrow-layout fixes in the study are scoped to the study only.

The pre-study source snapshot and its verified hash manifest are stored outside
the repository in `C:/Users/86137/Documents/Codex/StashDock-backups/`, timestamp
`20261025-143810`. Extract into a separate folder first; do not overwrite newer
Desktop or plugin source as part of a website rollback.
