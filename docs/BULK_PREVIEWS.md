# Bulk bookmark previews

New bookmark imports process details with four bounded readers, then commit in
chunks of at most eight references. A compact shared Arc progress surface replaces
the import form over its dimmed backdrop until saving completes, with one modal
and focus owner; there is no body-status instruction or completion summary.
Single-link Save shares its in-flight detail lookup and waits for that result too.
Thumbnail enrichment remains a
separate persistent queue with one leased owner and two image lanes shared by Desktop and MCP.
No user title, non-empty content, final context, tags, favorites or original file is rewritten.

## Image pipeline

`preview_enrichment.rs` is shared by Desktop and the plugin's native helper.
For ordinary pages it attempts one screenshot and publishes a successful image to
both hosts immediately. A successful missing-cover job then ends; missing icons
are handled by the existing lower-priority icon-only queue after its retry cooldown.
Do not serialize HTML/icon fetching in front of the next missing cover.
An existing raster favicon plus successful screenshot needs no HTML request.
Screenshot failure returns immediately for one retry. A second failure ends loading
and uses the normal default cover; it does not download an OG image to mask failure.
PDF context imports are metadata-only: explicit `.pdf` links skip downloading,
and extensionless PDFs stop at their content type or a short signature probe.
Optional background covers render only page one of PDFs up to 5 MiB, without
extracting text or metadata from the document.
Missing covers precede jobs that only need an icon; never-attempted links precede
due retries within each class. MCP starts the next task immediately on completion.

The image queue does not run the content extractor. A separate, single text lane
fills earlier, unsettled browser-bookmark and manually saved URL content using `link_metadata::fetch_content`, the
same reader as pasted URLs. New imports persist `contentSettled` after their
foreground read, including an unavailable/empty body, and are excluded from this
legacy lane at both claim and publication. It owns a separate text-work lease, so a still-running
older image-only provider cannot block text extraction. It rechecks ID, URL,
empty body and absence of a final-context override, and updates FTS atomically.
Quick save persists a provisional `pendingTitle` only for an untouched URL-based
title. Background completion replaces that exact provisional title, never a user
title; metadata editing clears the marker. `contentEdited` protects an explicitly
cleared form body. A title-only response does not mark missing body work complete.
Existing bookmarks and empty manual links are eligible; reimporting is unnecessary.
This legacy text lane retains its existing three-attempt policy. The independent image
queue permits exactly two attempts, with no cooldown and immediate retry priority.
Public HTTP extraction cannot
guarantee access to authenticated/JavaScript-only articles; the Save sidebar
continues to capture the current readable browser document instead.
The foreground lookup retains its existing bounded single-flight screenshot cache.
Stale completion merges only image fields after rechecking the saved ID/URL;
newer user/extension imagery wins. Unchanged icon callbacks do not write again.

## Resource limits

- Background screenshots use two isolated lanes. Native single-flight cache allows at
  most two pending captures including foreground work; its cache has eight
  entries with a three-minute success TTL. Failed results are retryable.
- Each of two native renderer slots is reused serially, paused between tasks,
  released after 20 seconds idle and retired after three minutes. Reuse awaits
  native profile clearing, cancels old network tunnels and resets CDP domains.
  A failed reset discards the renderer. MCP uses two bounded serial NDJSON helper
  sessions, releases each after 30 seconds idle, and publishes images before optional
  icon work or process cleanup. Abort/timeout kills only its owned helper; active
  admission remains reserved until close and scratch cleanup.
- Two user/session-scoped Windows mutex slots bound active public renders across
  Desktop, MCP, foreground lookups and PDFs. Abandoned slots recover after an
  owned process exits. This is a concurrency bound, not a CPU percentage cap.
- Each isolated system WebView2 session retains its private temporary profile,
  22-second capture deadline and
  public-only pinned proxy (24 concurrent connections, 24 MiB transfer budget).
  Runtime policy `capture-v5` probes the viewport at most every 200 ms after
  load/initial navigation progress. It waits for readable/rendered material,
  visible images, fonts and non-busy content, plus 600 ms of stable content/layout.
  Offscreen images and streaming connections do not hold it open. After five
  seconds a drawable page may be captured best-effort even if a font/image/busy
  marker or continuously changing layout never reaches full readiness. A blank
  viewport still fails after ten seconds; the overall deadline remains authoritative.
  This is a bounded readiness heuristic, not proof that every third-party widget
  loaded or every failed resource recovered.

  **Rollout caveat:** replacing a plugin's files does not replace its running Node
  module or its lease. A live legacy owner can keep the queue on its old policy.
  Confirm `web_preview_runtime_version` and the real running provider after host
  reload; do not steal an active lease or call file hashes alone runtime acceptance.
- The browser Job Object retains its 768 MiB committed-memory limit. This is
  not a hard cap on the entire WebView2 tree: sandbox children created before
  assignment may be outside it and cannot safely be reassigned. The original
  native sandbox remains enabled.
- Browser jobs run below normal priority. Existing owned children receive the
  same priority where Windows permits it; failure to adjust a sandboxed process
  never fails capture. This is not a CPU cap or a guarantee of silent fans.
- Thumbnail requests deny audio/video and streaming channels, while keeping
  document, script, CSS, image, font and ordinary data requests for layout.
- Native commands keep the 32-entry bound but wait up to one second for temporary
  backpressure on the capture worker (never on the COM thread). The STA processes
  eight commands per turn before pumping messages. Unused subresource network
  notifications and successful fire-and-forget Fetch acknowledgements are not
  sent to the 256-entry event channel. Document identity, Fetch interception and
  loading failures remain observable; event overflow still fails explicitly.
- Optional metadata has an eight-second deadline; icon and fallback cover
  downloads each have a four-second budget. Icon-only maintenance never starts
  a renderer. The worker's 90-second lease covers this bounded job path.
- Each image task has a 60-second claim deadline independent of its provider's renewable
  90-second lease. Expired tasks are recovered with the remaining attempt budget;
  exhausted tasks become failed. Publication checks the attempt token and deadline,
  so an old result cannot overwrite a reclaimed task. When MCP owns the queue, one
  existing Desktop worker observes SQLite data-version/task-expiry changes every two
  seconds and emits the ordinary update event only on change. It never polls the full
  library or thumbnails, and the UI has no additional polling loop. The MCP shelf has
  matching task-expiry annotation.
- The text lane probes changes every two seconds while idle and avoids a full
  unchanged empty-queue scan for 15 seconds. Leases renew near expiry, not on
  every probe. The legacy text lane has one background task; images have at most two.
- A failed
  attempt leaves the loading UI, even during its retry cooldown; actual queued
  or working jobs pulse continuously. Reduced motion remains static.

Run `node scripts/benchmark-bulk-previews.mjs` after building the helper for an
alternating old/new public-page timing comparison. The fixture supplies a small
saved icon, never reads the user's bookmark URLs and never writes the library.
Optional `STASHDOCK_PREVIEW_DIAGNOSTICS` reports Job Object CPU milliseconds,
peak committed MiB and process count. These counters do not include pre-existing
sandbox children outside the job, the UI process or the whole computer.

Windows priority semantics: [Scheduling priorities](https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities).

`node scripts/verify-preview-session.mjs <new-helper> [old-helper]` verifies real
screenshots on three public URLs, one renderer/two resets, early image output,
exact foreground/background text parity and optional old one-shot timings. This
small network-dependent check is not a 65-site throughput or whole-machine CPU
benchmark. Visible-card scheduling and persistent deleted/reimported-URL caching
remain separate, unimplemented follow-ups; no such benefit is claimed here.
