# Chrome, Edge and Firefox Save-page extensions

## Implementation

Version 0.4.12 has one Save-page form, extractor, session controller, RPC and
durable outbox. Browser-specific code is restricted to the native sidebar adapter
and generated manifests. Chrome/Edge require 141+; Firefox requires 153+ to retain
document-ID capture guards and uses a module event page rather than a service worker.
Save confirms in place, keeping the sidebar open. Tab/navigation changes refresh
the current draft using the existing dirty-field and stale-completion protections.

Desktop and MCP Settings now expose Edge/Firefox setup and usage guides, brand
icons and registered-client/official-site launch actions. Safari remains planned.
Firefox registration separates its stable runtime ID from its per-profile origin
UUID. Both providers validate this boundary; detection reads the matching current
active addon metadata rather than assuming a past connection proves installation.

## Packages and installation

Run `npm run extension:build`; outputs are `output/extensions/chrome`, `edge`
and `firefox`. Each includes the shared assets and dependency notices.
For Edge, use `edge://extensions` → Developer mode → Load unpacked → `edge`.
For Firefox development, use `about:debugging#/runtime/this-firefox` → Load
Temporary Add-on → `firefox/manifest.json`. Temporary installation ends on browser
exit. The unsigned Firefox ZIP is not a permanently installable XPI; Mozilla
signing/AMO distribution remains release work. No signature/security override.
Existing Chrome development installs may retain `extension/` to preserve their ID.

## Verification evidence

- 308 frontend tests passed; type checking and generated UI parity passed.
- 131 native tests passed, with one OS-clipboard test intentionally ignored.
- Production desktop, independent MCP package and three browser targets built.
- Desktop/MCP Settings guides passed rendered checks in both themes at 390,
  768, 1024 and 1440 px, including setup/detected usage and mock launch actions;
  zero page errors. Narrow screenshots were inspected. Installed Desktop loads
  `http://tauri.localhost/` packaged assets and its browser rows/Edge guide were
  checked in the actual window. Installed MCP protocol/resource smoke reports v49.
- Firefox web-ext 10.8.0 lint: zero errors, four existing bundled React/Readability
  innerHTML warnings. These are recorded, not suppressed or presented as AMO approval.
- Actual Firefox 158 disposable-profile smoke confirms background startup,
  session storage and raster encoding. Website access remained ungranted;
  document extraction was permission-gated, not counted as a passing end-to-end test.
- Edge 155 CLI extension loading did not start the extension; no claim of actual
  Edge toolbar/sidebar acceptance is made from that attempt.
- Both local providers' Firefox/Edge registration and rejected foreign/mismatched
  origins have isolated integration tests, with no writes to the real collection.

User acceptance still requires installation and native website permission in each
browser, then keeping the sidebar open while switching/navigating websites,
late-rendered content, edited drafts, duplicate Save and provider restart. No
automated website grant, cookies, daily profiles or signed-in account content was used.
Firefox requires explicit website-content/current-URL data consent for transfer
to the local provider; this adds no remote telemetry or history collection.

Pre-change recovery snapshot: `artifacts/browser-extensions-20261016-before`.

Installed desktop SHA256:
`43BA413520DF8B2D718E86EBD8D05CD4463470FEB15DB9F6E5F1ACE79176A489`.
The real 47-reference library retained its content/pin fingerprints after deployment.
