# ChatGPT plugin 0.4.36

Fixes Add to chat staying disabled when ChatGPT restores a previously opened
StashDock panel before the conversation input box has mounted.

- Detect the documented `openai/message: {}` extension with text-message support,
  rather than requiring the transient, undocumented `draft` hint.
- Keep every user-requested addition explicit: `target: "active", send: false`.
  Host rejection shows an error and permits a manual retry. It never triggers an
  automatic resend, a sent message, a new conversation or a different API.
- Refresh host-derived UI state on context notifications and use the plugin
  manifest version in the UI handshake. The shelf resource is now v61 so new
  host sessions load the corrected UI.

Install the complete Windows x64 plugin ZIP following the
[plugin installation guide](windows-plugin-install.md). Restart ChatGPT once
after updating to replace existing server sessions and restored panel resources.
StashDock Desktop remains 0.2.6 and browser extensions remain 0.4.16.

Verification: all 458 frontend/MCP/website tests and TypeScript passed. Real App
SDK transport tests cover handshakes with and without the legacy hint, a
temporarily absent composer, rejection without automatic retries, and the exact
draft-only payload. The production UI was exercised with an isolated host
fixture for single/bulk additions, restoration and manual retry; its test draft
was preserved. The original issue was also reproduced in the actual ChatGPT
panel. A restored native conversation using the new host session still needs
acceptance after restarting ChatGPT.

The extracted Windows package and installed copy passed all 168 manifest hashes,
bundled Node startup with an empty PATH, MCP resource and native lookup checks.
This plugin-only release does not replace the latest Desktop release.

Protocol reference: [OpenAI plugin extensions](https://developers.openai.com/plugins/build/extensions).
