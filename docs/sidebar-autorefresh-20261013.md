# Save sidebar automatic current-page refresh

Version 0.4.5 restores the simple interaction: open once, switch sites/tabs and
the sidebar refreshes automatically. Retry reads the current tab. Save remains
explicit and closes only after a durable commit.

Website/screenshot access is declared in optional_host_permissions. Chrome asks
for consent in the toolbar gesture; it is never granted by debugging/automation
or added to the extension's required localhost-only permissions. The screenshot
API requires all_urls or a per-tab activeTab grant, so the optional permission
uses all_urls; extraction nevertheless refuses every non-HTTP/HTTPS URL. No
Cookie APIs, login/session exports, hidden field values or background pages are read.

The live sidebar owns navigation subscriptions. Worker capture-sessions keep
one latest task per window, wait for navigation completion, and reject stale
results. Document-bound extraction waits at most two additional seconds for SPA
post text. Quota retries are bounded. A sidebar port authenticates the current
instance; closing/disconnecting it cancels reads and prevents queued old messages
from reviving a session. There is no global background-tab capture listener.

Validation uses an owned Chromium profile with the same code and a test-only
manifest modelling already-granted optional consent. It opens with one toolbar
click, then validates cross-origin navigation, new tabs/switch-back, rapid
switching, login-only errors/Retry after visible content arrives, and no new reads
after closing. This fixture does not claim to have accepted the native permission
dialog in the user's Chrome or to verify every signed-in platform.

TypeScript and all 214 frontend regressions pass. The real browser fixture also
retains explicit durable offline Save, edited title/content/tags, automatic close,
and shared light/dark sidebar layout at320/390/480/768px. No user-library writes
are used by these tests.

The native/Codex library and desktop binary are unchanged by this extension-only
update. UI retains existing Arc fields, tags, loading skeletons and inline errors.
