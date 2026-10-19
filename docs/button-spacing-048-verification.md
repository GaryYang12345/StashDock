# Button and attachment-label verification — 0.4.8

## Changes

- Shared desktop/MCP card URL groups now use intrinsic width and shrink when necessary. The visit icon follows URL text rather than filling the distance to the action.
- Removed card Copy/Add adapters that compressed Arc's 14px/500 text and 12px small-button horizontal padding to 12px text and 8px padding.
- Medium text buttons retain 44px height/16px horizontal padding; small text buttons retain 36px/12px. Icon-only controls intentionally use their square sizing and zero horizontal padding.
- Very narrow cards use accessible icon actions with the full action tooltip; they do not reduce typography/padding to fit. Wider cards retain compact/full text labels.
- Restored the archived Dock Copy button's standard Arc sizing; aligned Chrome extension text-button spacing with the same dimensions.
- Vendor Arc primitives were not modified. Tag-input remove-button geometry and left-aligned navigation rows retain their intentional component layouts.

## Rendered checks

Isolated MCP harness with six cloned references, not the real Codex composer:

- Button audit at iframe widths 390, 439, 768, 1024 and 1440, plus selected footer, both editors, all four import modes and tag filter. Visible Arc button text measured 14px/500, equal left/right padding and centered content groups within 1px.
- Short URL measured a 4px gap to the visit control with source flex-grow 0.
- Interaction/layout check at widths 320, 380, 390, 439, 600, 720, 768, 900, 1024 and 1440: footer stays one row, no overlap/overflow. Menu preserves lift; favorite uses progress, not forbidden cursor; controls hide on exit; select tooltip and reduced motion pass.
- Draft request retains titled text and send:false without changing fixture draft text. This does not prove the real host's outer chip uses the title.

Built dashboard with demo data:

- Button audit at widths 390, 768, 1024 and 1440, selection bar, edit card and import dialog: same typography, symmetric padding and centered content group checks pass.
- Menu lift, select tooltip and one-row footer layout pass.

Frontend: 158/158 tests passed. Desktop release build and Windows brand-icon verification passed. Linker emitted missing-library-PDB warnings, not build errors.

## Why the composer still says “上下文 · 1”

Read-only inspection of installed Codex 26.1007.2314.0 app.asar:

- app-initial asset: Gta reads `_meta["openai/title"]` from text/image content and title from resource links.
- app-primary asset: attachments with content are grouped; the outer label uses `composer.mcpAppModelContext.contextCount`, default `Context · {count}`. The host translates that label using its own locale. Titles are used for the entries inside the popover, not this outer label.
- A different internal branch uses composerLabel for attachments without content. That is host state, not a supported StashDock title metadata field. We did not inject private host state or alter the host installation/global language.

Therefore the earlier assumption that titled text would replace the outer chip label was incorrect. A plugin reload cannot fix that host-owned label. An English host locale would show Context · 1, still not the individual reference title.

Reproduce bounded read-only evidence with `scripts/inspect-host-context-label.mjs` and the installed ASAR path. No host source changes were made.

## Installed artifacts

- Plugin 0.4.8; UI resource ui://stashdock/shelf-v10.html. Read-only installed MCP smoke check returned 29 items and verified editor tools, responsive breakpoints and bundled UI.
- Desktop D:/StashDock/stashdock.exe SHA256: 36E7620FCCAEB09AA772E411FDFBC9E0C19DD2F9B07EAA0A127397FAECA5DDC6. Replaced and restarted after hash comparison.
- Previous plugin/executable backed up under artifacts/plugin-before-spacing-048-20261010 and artifacts/stashdock-before-spacing-048-20261010.exe.
- Real library row/pinned hashes unchanged before/after this work. All browser mutations used cloned/demo data.
- Existing Codex plugin connections require host reload to display the new UI. Actual host chip-label behavior was verified in source, not changed.
