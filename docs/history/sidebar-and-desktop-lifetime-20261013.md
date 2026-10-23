# Persistent save sidebar and standalone desktop lifetime

## Browser extension 0.4.7

- Chrome owns the sidebar Close control. The form header uses the same Arc ghost
  Refresh button as the shelf. It explicitly recaptures the current document,
  keeping manually edited title/content/tags.
- The Content field uses the body region's remaining height. Short windows can
  scroll the form body; the Save footer remains reachable. Arc internals, shared
  fields, tooltip and scrollbar styles are unchanged.
- Durable Save confirms in place and never closes the sidebar. Editing enables
  Save again; later navigation reads the next page. Save completion is bound to
  its request generation so it cannot mark a different page Saved.

Verified in the actual native Chrome side panel with an owned synthetic-page
fixture: 320x460, 390x704, 550x1400, 480x704 dark and 768x850 dark. At 550x1400 the
textarea expands to approximately 874 CSS px rather than stopping at 160px.
Explicit title/content/tags and screenshot survive durable offline Save; the
sidebar remains open, preserves edits through Refresh and reads the next page.
Screenshot: `output/playwright/sidebar-persistent.png`.
The continuously open sidebar regression also retains the same target through
30 navigations and a real service-worker stop/restart.

## Desktop lifetime

The previous handoff ran only when IsProcessInJob returned true. Launchers can
also clean up process trees without using that job mechanism. In addition,
handoff errors previously logged and then continued into a host-owned desktop;
the independent marker skipped job verification entirely. These are concrete
gaps found in the startup code, not proof of which external exit mechanism the
user's ChatGPT/Codex used on the reported occasion.

The first desktop invocation now always hands off to the interactive Windows
shell before Tauri/single-instance initialization. The replacement is suspended
while its job independence is checked, resumed only after validation, and never
inherits standard handles. Marked replacements still validate job membership.
An unsuccessful handoff reports a Windows error and exits; it does not silently
start a lifetime-coupled window. Shared SQLite data does not imply shared process
lifetime. MCP shutdown has no desktop-termination path.

`verify-desktop-independence.ps1` starts a project-built desktop through its own
hidden, suspended PowerShell launcher inside a non-breakaway kill-on-close job,
using a new isolated library directory. It verifies the replacement is
Explorer-owned and outside jobs, closes only the owned launcher job, then checks
the desktop survives and both packaged native windows are correctly configured.
It refuses to run over an existing user desktop and cleans up only its owned
test instance. No actual ChatGPT/Codex process is terminated for this regression.

Packaged runtime result: the test launcher's kill-on-close job terminated its
PowerShell launcher, while the Explorer-owned desktop survived outside jobs.
The normal 1195x769 panel was visible/non-topmost with native DWM non-client
rendering; the separate 160x232 folder was hidden/topmost. The isolated test
instance alone was stopped after verification. The verified production binary
was then hash-checked into `D:/StashDock/stashdock.exe` and launched normally.

Checks: 226 frontend tests passed, TypeScript and canonical Arc assets passed;
native suites passed (67 library, 2 desktop startup and 18 helper tests), with
the existing OS-clipboard mutation test intentionally ignored.

Recovery snapshot: `artifacts/before-sidebar-persistent-startup-20261013`.
The database backup contains 44 references; it is recovery evidence only, never
automatically restored over newer user data.
