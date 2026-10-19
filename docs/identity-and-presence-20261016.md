# Reference identities, circular controls and current presence

## Shared presentation

- AI setup and usage guides share one constant: “Browse your library and use
  references as context in conversations.” The translation is shared too.
  Browser capture retains its separate, save-only purpose.
- The explicit StashDock Arc variant marks icon-only buttons using the existing
  label classifier. Product CSS gives them equal width/height and a 50% radius,
  including loading/hover/press. Labelled buttons retain Arc geometry. Compact
  help affordances keep their established transparent foreground-only hover.
  The card Open action no longer forces a narrow axis onto a taller button.
- Default covers and source glyphs use one curated offline icon registry, not
  handwritten paths. Sixteen identities cover web, repository, note, PDF, Word,
  spreadsheet, presentation, image, video, audio, code, structured data,
  Markdown, plain text, archive and generic file. The existing MIT icon sets and
  notices are reused. Pictures now use the orange framed-picture asset/tint,
  not the old blue page over a green background. Actual/custom covers are kept.
- The standalone specimen has 19 cards including CSV, YAML and Python examples.
  It is output/visual-gallery/index.html, with an optional local preview on
  port 18751. It is not a production route or a library seed. Regenerate it with
  node scripts/build-reference-gallery.mjs.

## Detection correction

Settings already refreshed on mount/focus; the fault was its evidence, not a
missing refresh. A cached plugin manifest or historic browser handshake used to
remain Detected after removal. No result cache, timer or diagnostic UI was added.

- ChatGPT now requires both the registered StashDock package and explicit enabled
  configuration for that marketplace. A disabled StashDock MCP override also
  invalidates detection. Established TOML parsers are used, with a 2 MB bound.
  Only this plugin's fields are considered. User-level configuration is checked;
  this is not an inference about every trusted project's override.
- A browser handshake retains the extension ID from its origin/runtime. Conflicts
  are rejected. Current enablement is checked only for that ID. A successful old
  handshake alone is insufficient. Secure Preferences takes precedence over
  legacy Preferences, even when its entry was removed.
- Chromium 141+ may omit state/disable_reasons on enabled extensions and omits
  cached manifests for unpacked extensions. The detector handles those semantics
  and reads the known extension's own manifest when required. Profile metadata
  work is bounded to 32 profiles, 16 MB per settings file and 64 MB total.
- No browser/host configuration is modified, no authentication is inspected, and
  cookies/history/page data are neither accessed nor exposed for this check.
- Browser detection currently handles standard Chrome/Edge profile roots. The
  unimplemented browsers and Claude remain Coming soon. An extension must make
  its identifying handshake after this update; reload it and open StashDock once.
  Arbitrary custom browser data roots are not claimed as supported detection.
- Desktop still verifies its registered executable. Installed-but-closed is not
  confused with current connectivity. Only reliable evidence renders Detected.

References for the host-specific adapters:

- [OpenAI plugin configuration](https://developers.openai.com/plugins/build/plugins)
- [Chromium extension preference semantics](https://chromium.googlesource.com/chromium/src/+/141.0.7390.122/extensions/browser/extension_prefs.cc)

## Verification

- Frontend: 291 passed, zero failed. Native: 129 passed, zero failed; one existing
  interactive clipboard test remains ignored. TypeScript and generated extension
  asset parity passed. New Node TOML parser license is included in plugin notices.
- Presence regressions cover enabled, disabled, removed configuration while
  cached files remain, malformed TOML, marketplace mismatch, MCP disablement,
  browser disable/re-enable/removal, omitted modern fields, unpacked manifests,
  stale legacy metadata, invalid IDs and origin/runtime-ID mismatch.
- Rendered gallery: all 16 categories have nonempty covers, circular icon targets,
  and no horizontal overflow in both themes at 390/768/1024/1440. Setup/guide
  copy equality, re-entry/focus refreshing, black help, numbered steps, focus
  return and 320px settings layouts passed in desktop fixtures.
- Packaged MCP HTML through the real SDK and an isolated library passed guide
  copy, circular Close, valid Desktop detection, no fabricated Chrome detection,
  Open app transport, five widths, preference persistence, retry, host-theme
  behavior and retained search/selection. Actual ChatGPT UI was not automated.
- Read-only inspection of this machine's StashDock Chrome metadata confirmed its
  enabled unpacked extension is recognized. No real extension was disabled or
  uninstalled for testing; those transitions use isolated metadata fixtures.
- Recovery snapshots: artifacts/stashdock-before-identity-presence-20261016.exe
  and artifacts/library-before-identity-presence-20261016.sqlite3.
- Library remains 46 references. Preserved reference signature:
  a07ff65b8ed740ecf8fbc95c7e308c31147fd4c25ce5625fd9ccf35720d8c8a0.
- Installed Desktop cold-started with Vite stopped, displayed the 46-item shelf,
  Settings and the ChatGPT guide with the shared copy. Executable SHA-256:
  27e30293a98c25552a3cc993f8a57119f9378984f79980d2668006ac6bf24de6.
  Embedded frontend: index-C8GdA6fq.js.
- Installed plugin HTML, bundled server and both helpers match the final source
  artifacts. HTML SHA-256:
  26595f9ef5095b859163b26e73457688ebff203937a5544d00a51a2b4c658736.
  Reconnect the plugin to load shelf-v44; reload the unpacked browser extension.

Arc review: shared components/tokens, curated assets, both themes, responsive
layout, existing focus/reduced-motion behavior and purposeful color were checked.
The circular icon-only shape is an explicit user-requested StashDock variant,
not a claim about Arc's default style or a universal industry requirement.

## Image choice C (subsequent user decision)

The user selected Flat Color Icons `image-file`, replacing the orange `picture`
asset described above. Cover and source glyph share the unchanged upstream blue
asset; the default cover now uses the blue semantic tint, not green or orange.
The standalone specimen was rebuilt. Both themes, exact upstream asset identity,
TypeScript and 291 frontend tests passed. The installed Desktop embeds
index-DI732Zrv.js and cold-started successfully; SHA-256:
7a17a72366a0b2bb09c27da76281cc2cdbd7bad1e0ffbc474f0edc0ef5723ae9.
The plugin cache matches shelf-v45 and the rebuilt server. User references remain
unchanged (46 items and the signature above). Native logic was not changed.
