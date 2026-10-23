# Native handoff, portrait layout and extension capture

The native-window rollback baseline remains immutable at
`artifacts/version-before-native-windows-20261013`. An additional installed
binary/plugin and consistent library backup was taken before this deployment
at `artifacts/before-motion-deploy-20261013`; its source contains this turn's
in-progress implementation, not the pre-architecture baseline.

## Changes

- Native frame, shadow, geometry and Z-order policies are unchanged. The native
  coordinator stages a sender-validated transition before committing visibility.
  Arc transforms move inner content; the opaque panel is never faded or scaled.
  Latest intent cancels stale acknowledgements, and a 650ms watchdog prevents
  a suspended outgoing renderer from trapping the app. Reduced motion is immediate.
- At widths <=880px, full sidebar navigation is hidden. Collections use the
  installed Arc segmented control below Search, with pinned tags retained. Tags,
  grid/list and Refresh share a compact row. MCP and desktop use ShelfTagFilter;
  optional desktop pin actions stay a host capability, not a second menu.
- Chrome capture installs its reader in ISOLATED world, then explicitly returns
  its result in a document-ID-targeted function. File injection completion values
  are not used. Screenshot rate-limit errors retry at most twice, rechecking page
  identity after every wait. Permissions and authenticated-page privacy are unchanged.
- Unpacked extensions need Reload in chrome://extensions. The owned test browser
  demonstrated a cached old background module surviving process restart while
  loading new injected assets; source files on disk alone do not prove active code.

## Evidence

- TypeScript and production frontend build pass; 207 frontend tests pass.
- 85 native tests pass; one opt-in test remains ignored.
- Real packaged Windows/WebView2 at 150% DPI: 390/768/1180/1440px widths in both
  themes keep imports, Save and tag popovers within bounds and provide >=300px
  of card viewport at 760px height. At 390x900 the card region is about585px.
- Twelve native handoffs preserve client size, search and DOM nodes. Maximize,
  restore, hide and reopen work. DWM remains active, panel has no custom region
  or topmost flag, and only the folder is topmost.
- Intermediate animation stays fully opaque, quick reversal cancels stale work,
  suspended-script fallback and reduced-motion behavior pass in native WebViews.
- Real Chrome extension toolbar permission and side-panel targets were tested in
  an owned profile: generic article/X/Xiaohongshu/Zhihu DOM fixtures each read
  twice with text plus screenshot. These are synthetic platform fixtures, not
  signed-in platform/account acceptance. Sidebar320/390/480/768px light/dark,
  editable metadata/tags, explicit durable offline Save and automatic close pass.
- No daily browser process, Cookie store, original file or live-library row is
  modified by tests. Public-network checks are reported separately from fixtures.
- A live example.com navigation in the owned Chromium profile timed out, so
  the fixture tests are not presented as proof of that profile's external-network
  access. The user's normal Chrome still reports a failure after extension Reload;
  actual-profile diagnosis is in progress and capture is not yet user-accepted.

Run `verify-native-window-layout.js`, `verify-native-window-handoff.js`,
`verify-native-window-motion.js`, `verify-capture-multiple-pages.js` and
`verify-real-browser-capture.js` through playwright-cli against owned fixtures.
