# Settings tooltip refinement

Supersedes the click-operated help described in settings-refinement-20261016.md.

## Shared presentation

- SettingHelp is a small labelled question-mark button beside its field or section
  heading. It uses the existing delegated black tooltip layer, not a popover.
  Pointer hover changes only foreground; keyboard focus shows the same hint and
  retains the foundation focus indicator. Escape dismisses without moving focus.
- Browser extensions, AI plugins and Desktop app explain their purpose in that
  same tooltip instead of a persistent description paragraph.
- Ready integration rows have one action: Set up, or a non-actionable In use
  button when detected. Configured badges and View guide labels are removed.
  Planned products retain Coming soon. Detection and shared storage are unchanged.
- Desktop, ChatGPT and the browser Save sidebar compose the same components.
  The native-canvas tooltip adapter remains the existing project exception to
  Arc's viewport portal; no second tooltip implementation was introduced.

## Verification

- TypeScript and generated extension asset parity passed.
- 285 frontend tests passed. Native tests: 126 passed, one pre-existing ignored
  interactive clipboard test, zero failures.
- Rendered desktop: hover foreground only, transparent background, black hint,
  no popover semantics, keyboard focus/Escape, heading explanations, one In use
  action, both themes and 390/768/1024/1440 layouts.
- Browser fixture: section explanations, provider recovery, In use, retained draft
  and Save keeping the sidebar open. Chrome API calls are simulated in this fixture.
- Packaged MCP UI with the real SDK and isolated library: section hints,
  320/390/768/1024/1440 layouts, persistence, error/retry, theme override and preserved
  selection/search. The real ChatGPT host UI was not automated.
- Recovery snapshots: artifacts/library-before-settings-tooltips-20261016.sqlite3
  and artifacts/stashdock-before-settings-tooltips-20261016.exe.
- Installed Desktop cold-started with Vite stopped; actual native settings showed
  the compact section help, shared black keyboard tooltip and single In use button.
  Embedded frontend: index-DgSuKq40.js. Installed executable SHA-256:
  21C24CB41C44CBB1D29BCE3EE634A014ACEED2EC70C7812D7E6ADC0A3079DF86.
- Installed plugin HTML/server hashes match their build. Reconnect the plugin to
  load shelf-v41, and reload the unpacked browser extension to load its updated UI.
- All 46 user references retain signature
  a07ff65b8ed740ecf8fbc95c7e308c31147fd4c25ce5625fd9ccf35720d8c8a0.

Small help targets intentionally follow the requested compact desktop affordance;
the 24px hit area exceeds the 14px visible icon. No custom focus ring or animation
was added. Dark theme uses its semantic foreground rather than invisible black.
