# Local import cover pilot (2026-10-14)

Historical pilot evidence. Superseded by [Edit cover and Codex sync](edit-cover-sync-20261014.md). The user manually tested the final local pilot and reported no current problems. The later release enables the shared cover picker in both hosts; hashes/counts below describe the earlier pilot, not the current installation.

Scope: local app only, as explicitly requested. The Codex import UI and save-only browser extension were not deployed or enabled for this feature. Both still display saved cover previews through their existing shared reference presentation.

## Interaction and ownership

Job: optionally select a cover while editing a new Link, Note or File reference.
Primary action: the existing explicit Save reference action, not selecting an image.
Regions: existing Arc form fields plus one quiet Cover row built from the installed Arc Button and Alert. A native file picker opens directly; there is no permanently expanded dropzone, second primary action, nested decorative card or new motion system.

- Cover remains a 44px row. A selected image has a 48×32px thumbnail, a truncated filename, Replace image and a named Restore default cover action. The ordinary form remains within a 769px-high panel; smaller surfaces retain the existing reachable scrolling behavior.
- Link and Note cover drafts are independent and survive type switching until the dialog closes. Batch file drafts own their respective covers. Image preparation blocks Save/type/file replacement until it settles; only explicit Save commits data.
- An invalid replacement retains the existing selection. Restoring the default removes the override, not the reference. Async page lookup updates its own automatic preview independently and cannot replace a selected cover.
- `ReferenceCoverField` owns picker feedback; `referenceCover.ts` owns preparation/provenance composition. The optional `LinkImportService.prepareCover` capability is enabled only by the local adapter. No duplicate host form or new dependency introduced.
- Native `reference_cover.rs` decodes bounded base64 on a blocking worker, then reuses the existing raster pipeline: PNG/JPG/WebP/GIF, maximum 5 MB input and 4096×4096 decoding limit, thumbnail up to 960×600 and 750,000 data-URL bytes. Active SVG/HTML, paths and remote URLs are not cover inputs. Choosing an image writes nothing.
- Files accept an optional prepared preview; the backend revalidates it before original-file writes, then commits preview and metadata with the original file in the existing transaction. Original bytes and AI content remain unchanged. Existing payloads need no schema migration. `origin.previewKind` is `cover`, and the background web worker already preserves nonempty previews.

Component references inspected: [Arc Button](https://uiarc.dev/components/button/markdown), [File upload](https://uiarc.dev/components/blocks/file-upload/markdown), [Popover](https://uiarc.dev/components/popover/markdown). Direct selection via Button avoids introducing a larger upload/disclosure flow for this optional one-image action; installed Arc internals remain unchanged.

## Acceptance

- 240 frontend tests passed; TypeScript/production frontend build and extension asset parity passed.
- 101 native tests passed (76 library, 2 startup, 23 helper); the OS clipboard-writing test remains explicitly ignored. Added bounded raster rejection/normalization and original-file/SQLite cover roundtrip tests.
- Nine rendered reports: light/dark, neutral/blue, 390/768/1024/1440px, normal/reduced motion, delayed lookup, replacement/restoration/failure, explicit Link/Note Save, per-file ownership and local-only capability gate. Screenshots inspected; no JS page errors. Services/database writes are simulated in the UI fixture, not the user's library.
- Arc review passed for semantic tokens, typography/copy, one primary action, compact gutters, stable row dimensions, keyboard-labelled controls, shared loading/error feedback, existing reduced-motion behavior and responsive overflow. Native chooser layout remains OS-owned. No global styles or window motion changed.
- Production native build enabled `tauri/custom-protocol`. Installed executable SHA256 `8FE015C5675EF52633B61D7F0F2A32B339EA4F16139DE6A7093EB28F44785496`; launches with the development server stopped and reads `http://tauri.localhost/` packaged assets. Normal non-topmost 1157×769 panel and independent hidden/topmost 160×232 folder verified.
- Actual installed app opens Import/Note and the native image chooser. The Windows automation tool cannot target the WebView-owned chooser's final Open action; end-to-end native image selection was therefore not confirmed. No test reference was saved to the live library. The test chooser/draft was cleared by restarting only StashDock; the clean app remains open.
- The installed Codex shelf HTML is unchanged (`28BA7082545D7ACA1FAD2F69236A21A272BFEED661D767C759A2FBCC334A5F0C`). No Chrome/Codex process or extension configuration changed.
- Recovery snapshot: `artifacts/before-import-cover-20261014`, 712 source files and consistent library backup. Live fingerprint remains 45 references, rows `e97232b31a52b3469ad4aef6d83bc80c4e05ca72985e628916d85e9d4dca977e`, pinned tags `631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864`.

Deferred: browser-page image galleries, manual crop tools and enabling the feature in other hosts require a later product request. This pilot selects an image from the user's device.
