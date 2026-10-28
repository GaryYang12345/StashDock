# StashDock Desktop 0.2.7 — Windows

Browser saving now works while StashDock Desktop and the AI application are
closed. Companion 0.4.17 calls a small installed Native Messaging component;
each request writes to the existing local library and exits. No background
service or additional database is required.

- Desktop setup registers the component for Chrome, Edge and Firefox.
- The AI plugin supplies an independent copy; either product is sufficient.
- URL duplicate confirmation, concurrent-edit protection and explicit retry
  receipts use the existing shared save transaction.
- A moved library is followed; unavailable library storage reports an error
  instead of creating a second library.

Update the browser extension and accept its native application communication
permission. Earlier unpacked development installs may need to be reloaded with
the new stable extension identity; preserve any unfinished draft first.

This package is Windows x64. Mac Native Messaging installation is a separate
platform integration.
