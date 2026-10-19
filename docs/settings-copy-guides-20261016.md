# Settings copy and usage guides

Supersedes the In use presentation in settings-tooltips-20261016.md.

## Shared UI

- Help icons use the normal pointer, not cursor: help. The existing shared black
  hover/focus tooltip, transparent trigger, foreground-only hover and keyboard
  focus behavior remain unchanged.
- Approved browser purpose: Save pages while you browse.
- Approved AI purpose: Browse and manage your references visually. Quickly add
  them to your AI conversations.
- Approved Desktop purpose: Browse and manage your references visually in a
  standalone desktop app. Bring them into any AI app.
- Storage retains only: Shared by StashDock Desktop and AI plugins on this device.
- Confirmed rows show Detected below the platform name and an enabled View guide
  action. Undetected rows retain Set up. Planned products retain Coming soon.
- Chrome, ChatGPT and Desktop have separate three-step usage guides covering the
  actual save/reference workflow. Installation links appear only in Set up.
  Guide intent is captured when opened so background status refreshes do not
  replace an open usage guide with installation instructions.
- Ordered guide lists explicitly use decimal markers so the Desktop CSS reset
  cannot hide step numbers that remain visible in the embedded panel.
- All content is localized in the shared locale catalog. Both primary hosts and
  the browser Save sidebar reuse IntegrationSections, SettingHelp and Arc Button
  inside the existing FluidDialog. No new tooltip implementation or service.

## Acceptance

- TypeScript, generated extension parity and semantic CSS sweeps passed.
- Frontend: 286 passed. Native: 126 passed, one pre-existing ignored interactive
  clipboard test, zero failed.
- Desktop rendering: approved tooltip content, normal pointer, black surface,
  transparent trigger, keyboard focus/Escape, Detected/View guide, real usage
  steps rather than installation, focus return, both themes and four widths.
- Browser fixture: provider recovery, Desktop usage guide, section hints, retained
  edited page and Save keeping the sidebar open. Chrome APIs are simulated.
- Packaged MCP UI with the real SDK and an isolated library: exact approved hint
  copy, pointer cursor, black help, Detected status, Chrome/Desktop usage guides,
  settled dialog rendering, Escape/focus return, and 320/390/768/1024/1440 layouts
  including row overflow checks. Real tool preference persistence, failure/retry,
  host-theme override, localized shelf and retained query/selection also passed.
  ChatGPT's actual host UI was not automated; reconnect loads shelf-v42.
- Recovery snapshots: artifacts/library-before-settings-guides-20261016.sqlite3
  and artifacts/stashdock-before-settings-guides-20261016.exe.
- Final installed Desktop cold-started with Vite stopped, displayed all 46
  references, Settings, Detected/View guide and the actual numbered ChatGPT usage
  guide. Embedded entry: index-CjHDV3DY.js. Executable SHA-256:
  D0301F6C18B5F54722DC27F4B3FF8407AD90813779C1F9E922DB74574EAC1F50.
- Installed plugin server and HTML hashes match the final build. HTML SHA-256:
  25354FBD51EC46D8EC25D56F23CCF3DB2730DE98D4E3E16FE984E0E3C1F3195D.
- Final user reference signature remains
  a07ff65b8ed740ecf8fbc95c7e308c31147fd4c25ce5625fd9ccf35720d8c8a0.

The compact help affordance intentionally retains its existing 24px target and
14px visible icon. Arc focus styling and reduced-motion behavior are preserved.
This is not a new broad code cleanup or a change to integration detection/storage.
