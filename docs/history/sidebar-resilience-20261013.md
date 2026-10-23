# Save sidebar lifecycle and progressive page capture (0.4.6)

The user requires a sidebar that stays open while browsing. 0.4.5's upgrade fixes
restored automatic navigation but still had lifecycle and partial-content bugs.
This revision replaces scattered client state with `sidebar-client.js` and keeps
capture ownership in `capture-sessions.js`.

## Concrete failure paths addressed

- Worker restart could leave a persisted `loading:true` entry with no live task.
  The old cache predicate kept returning it forever. Orphans now start new work.
- Native panel lifecycle/reset and connection loss could set a permanent
  client-side closed flag even while its document was alive. Only explicit Close
  or actual document unload disposes the new client. Reconnection is bounded.
- Each capture owns a client generation; stale responses cannot change current
  identity. Worker intents reject out-of-order forced reads. Session writes are
  serial, so delayed storage completion cannot overwrite the newest page.
- Navigation events are reconciled with a lightweight 2-second health check
  while visible/open. It does not re-extract healthy pages or read background tabs.
- All RPC deadlines/retries are bounded. Save is sent only once, even on timeout.
- A readable first paragraph is not proof that hydration is finished. Initial
  extraction samples the same document until content settles (bounded). A
  throttled mutation observer sends only change notifications; worker validates
  document ID, current tab, window and nonce before enriching content/screenshot.
- Enrichment updates untouched fields only. User title/content/tags are retained.
  Automatic Save page ignores leftover selections; explicit selection extraction
  remains a separate parser capability. Private forms and unrelated posts remain excluded.
- Body changes arriving during initial screenshot capture or later enrichment
  coalesce into another read. Notifications retry until acknowledged; a dead
  extension context disposes its observer instead of leaking repeated failures.
- Reconnecting a live client refreshes its document observer without blanking or
  overwriting the user's draft. Cached observers are stopped even after restart.

Optional webpage consent and all required localhost-only permissions are unchanged.
No Chrome profile, Cookie or login-state changes are needed. The native/Codex app
and user library are unaffected by this extension-only implementation.

## Verification

Unit regressions cover orphaned loading tasks, reordered replies, reconnect/reset,
missed navigation, disposal, progressive body text, stale document notifications,
partial-body settling, incidental selections and no automatic Save replay.
The owned Chrome fixture models already-granted optional website consent and
contains synthetic public pages; it does not assert universal website support or
native-dialog acceptance in the user's Chrome.

Evidence: the same native sidebar survived 30 navigations and a real background
worker stop/restart, without another toolbar click or replacing the sidebar
target. Delayed hydration completed automatically; manual title/content edits
survived enrichment. Navigation while temporarily hidden is recorded (not read)
and reconciled when visible again. Actual inaccessible/collapsed website content
still cannot be promised as complete; these tests establish application recovery.

Run `verify-sidebar-resilience.js` for a continuously open native sidebar, delayed
hydration, preservation of manual edits, repeated navigation and a real Chrome
ServiceWorker.stopWorker operation. It verifies restart by a worker-global marker,
because Chrome/Playwright may reuse the worker target without emitting a new
serviceworker event. Also retain `verify-sidebar-autorefresh.js` and the explicit
durable offline Save/light-dark layout checks in `verify-real-browser-capture.js`.

Final unit suite: 225 passing tests, plus TypeScript and canonical Arc asset checks.
Runtime fixtures do not write the user's live library or alter their browser profile.
