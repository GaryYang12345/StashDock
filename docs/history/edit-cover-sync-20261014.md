# Edit cover and Codex sync (2026-10-14)

The user accepted the local import-cover pilot, requested cover replacement in Edit card and enabled the feature in the Codex App. The Save page browser extension remains unchanged.

## Ownership and interaction

Job: choose or replace the reference thumbnail without changing original files or supplemental context.
Primary action: existing Save link / Save note / Save files / Save changes.
Regions: existing shared Arc forms, one compact `ReferenceCoverField` using installed Button and Alert, then the shared tag field. Official Arc Button documentation and composition/accessibility/design/checklist guidance were inspected. No Arc source was forked.

- Import and Edit card share the same picker, dimensions, thumbnail, replacement/reset actions, loading state and inline error recovery. Edit shows existing custom or automatic thumbnails. Cancelling leaves the stored reference intact. Title-only edits omit the cover mutation, preserving any concurrent/background image update.
- An omitted cover is unchanged; `{preview: string}` replaces; `{preview: null}` restores default. The optional host adapter supplies image preparation; desktop invokes Tauri, Codex calls app-only `prepare_stashdock_cover`. Both call the same bounded native decoder/raster pipeline. No screenshot browser, remote upload, temporary cover file or new package is required.
- PNG/JPG/WebP/GIF selection is limited to 5 MB. Decoding limits remain 4096×4096 and 64 MiB allocation; output is an opaque JPEG up to 960×600 and 750,000 data URL characters. Alpha composites on white, preserving black artwork. Saving revalidates prepared images rather than trusting MIME/extension alone.
- Cover and metadata edits commit atomically. Original asset bytes, content/final AI context, favorite, URL and identity stay unchanged. Managed image reset reads only the saved original inside the managed asset boundary; other files/notes use their normal fallback. Website reset removes the custom flag and clears its completed preview job so automatic capture is eligible again. Missing/unsupported managed originals use the normal file fallback, without reading an arbitrary path.
- MCP Link/Note/File imports accept custom cover provenance and inline thumbnails under the existing sandbox CSP. Prepared images are returned in app-only `_meta`, not model-facing text. Current UI resource is `ui://stashdock/shelf-v37.html`.
- Visual inspection caught the embedded host's missing `.sr-only` utility; its base stylesheet now hides shared screen-reader announcements without removing accessibility status. No global desktop theme/window/motion redesign occurred.

## Verification and deployment

- TypeScript and production desktop build; extension canonical asset parity; self-contained MCP build.
- 246 frontend tests, including app-only preparation, unchanged/replace/reset semantics, atomic failures, MCP file cover persistence, context/original-byte preservation and embedded status styling.
- Native suite: 80 library tests, 2 startup tests and 24 helper tests (106 passing); the separate OS-clipboard-writing test remains ignored. Native metadata transaction rollback and managed original restoration are exercised without live library writes.
- Rendered import fixture: nine reports covering light/dark, neutral/blue, 390/768/1024/1440 px, draft/tab/file ownership, replacement/invalid selection, explicit save and capability gating. Rendered editor: eight light/dark width reports for cancel/save/reopen/reset, plus actual packaged MCP import/edit in both themes. After the accessibility fix the MCP cases were rerun and screenshots inspected. No JavaScript page errors. Fixture form mutations are simulated; packaged MCP mutations use only disposable SQLite libraries and the real native helper.
- Real packaged-helper protocol acceptance: actual raster preparation, invalid active/nonimage input rejection, managed image restoration and original/context retention. No browser launch needed.
- Actual installed desktop opens packaged `http://tauri.localhost/` with Vite stopped; its Edit card displays the user's existing custom cover and Replace image. The editor was closed without saving. Native original/SQLite writes are tested separately; no synthetic reference was added to the live collection. The final local import chooser had already been manually accepted by the user.
- Installed plugin read-only smoke resolves shelf-v37 and its editor/context tools. Reopen/reconnect the StashDock plugin if a running Codex session still holds the old tool definitions; no Codex/Chrome/ChatGPT process was stopped.
- Installed desktop SHA256: `A54C8A55B983688A0973396706B41F1F9EDC8DCA3DC8347B03122E546439AA01`.
- Installed MCP HTML SHA256: `28A5B24FB36C7F0A5F6522F9E45990B25C63D438FC1A27F87305592A0692B60E`; server: `B81B87BC9DDECD5FC6FAA767CCF266C6AAC1A46446A785BF7B4B169B163B4990`; helper: `4777EB81FB4D083AF129C258BC9471ED4E35A1B1080DC7F01463963242189BEB`. Project/installed copies match; the packaged preview runtime is unchanged.
- Recovery snapshot: `artifacts/before-edit-cover-sync-20261014`, 719 source files plus installed builds and a consistent SQLite backup. Never restore that backup over newer user references.
- Live before/after fingerprint: 47 references; rows `957b3640330eaa91ec73e63a388dc020345f7df242a31c2e1db71a3e595d6929`; pinned tags `631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864`. Existing user data is unchanged.

Deferred: website-image galleries and cropping tools are not part of this change. Covers are selected from the user's device.
