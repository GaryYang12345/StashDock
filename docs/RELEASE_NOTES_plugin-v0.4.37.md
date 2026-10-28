# StashDock AI plugin 0.4.37 — Windows

The plugin includes an on-demand native save component for Companion 0.4.17.
After the updated plugin first starts, Chrome, Edge and Firefox can save pages
to the same library even after the AI application and Desktop are closed.
StashDock Desktop is optional.

The component exits after each request and accepts only authorized extension
IDs and the bounded page-save protocol. Duplicate confirmation and explicit
retry receipts remain shared with Desktop. Keep the complete extracted plugin
package in its permanent folder.

Start a new conversation after upgrading to load the new plugin. No separate
Node.js installation or always-running background service is required.
