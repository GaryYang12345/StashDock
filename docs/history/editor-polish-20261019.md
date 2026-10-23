# Content editor visual and motion review

## Corrections

- Context content is the primary field label. Content/Preview is a subordinate,
  text-only, compact size of the same segmented control used by Grid/List.
  Its field heading uses flex center alignment, not absolute positioning.
- The shared textarea accepts a trailing label action and a control overlay.
  The source textarea retains its geometry, draft, scroll and user resize while
  preview covers it. In preview it is invisible, inert and hidden from assistive
  technology. Markdown is created only when requested; external images/HTML
  retain the existing safety policy.
- The fixed dialog establishes a Motion layout root. Control, heading and field
  remain mounted and stationary while the existing shared highlight moves.
- Added a manual UI quality gate to AGENTS.md: inspect optical hierarchy,
  alignment, both directions, interruptions and real intermediate frames before
  delivery. Passing functional/source tests alone is not acceptance.

## Rendered evidence

- Initial candidate reproduced the reported reverse-motion defect: the highlight
  moved from y=350.40 to y=199.17 when returning to Content. Keeping the source
  field's layout reservation eliminated that transient centre/measurement shift.
- Final isolated production fixture, neutral/light: Content -> Preview travelled
  x=846.42 -> 910.03; Preview -> Content travelled x=910.01 -> 846.42.
  Both trajectories retained opacity 1 and y=199.20 (zero vertical displacement).
  A rapid reversal began at the current moving x=906.89, not the endpoint, then
  returned continuously. This is the same shared spring as Grid/List.
- At 390, 768, 1024 and 1440px: field control is 132.58 x 35.33 CSS px,
  field label/control centres and right field edges agree within 0.01px, gap to
  input is 8px and there is no horizontal page overflow. Pointer-coarse compact
  targets retain the shared 44px minimum. Keyboard ArrowRight reached Preview.
- 347 frontend tests passed. TypeScript and production fixture build passed.
  The new mounted-DOM regression repeats preview roundtrips and checks that
  textarea, heading, action, draft and scroll survive without collapsing layout.
- Dark/blue at 390px was visually checked. Arrow navigation works both ways.
  Reduced-motion sampling contains only the previous/final selection positions,
  without intermediate travel or vertical displacement.

Recovery snapshot: `artifacts/before-editor-polish-20261019`.
It also contains a consistent SQLite backup; never restore it over newer data.

## Deployment

- Rebuilt and installed `D:/StashDock/stashdock.exe`. SHA-256:
  `0f9f018b04541d1aa3a0b1304427afc5921d9a48145a715b6732b4e66ac5d7cd`.
- Actual packaged Windows window was checked on the MiniMax reference from the
  user's screenshot: compact field control, aligned heading, matching outer
  dimensions in Content and Preview, correct Markdown, and successful return.
  No context was saved. Final observation/closing the dialog became unavailable
  after the native window closed; stale coordinates were not used.
- Installer SHA-256:
  `17f57dac4c585acd0d3b2166154332aff79ffa84bad5e50713fe9590aeb57eaa`.
- Package: `output/releases/stashdock-plugin-0.4.27-win32-x64-editor-polish.zip`,
  42,398,160 compressed bytes. SHA-256:
  `ad40b7c494f97bb85b8ba29b70a78cb9916bf5f59eae7ab860f58f7f54f021aa`.
- Extracted package passed 185 manifest checks, bundled Node with empty PATH,
  relative stdio launch, isolated library read, native web and PDF lookups.
  Three changed files were copied into the installed personal 0.4.27 cache;
  unchanged runtime/data were retained.
- Final plugin-harness visual recheck was unavailable because the browser
  connection disappeared. Shared editor production-fixture and actual Desktop
  evidence above are not claimed as a host-specific visual check.
- Temporary viewport override was reset, fixture tab closed, and owned fixture
  servers stopped. No browser/system preference was changed.
