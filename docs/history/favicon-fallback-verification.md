# Lightweight favicon fallback

## Scope

Keep browser-supplied favicon metadata first. For old references without it, try only these image paths on the saved page's own origin, in order: `/favicon.ico`, `/favicon.svg`, `/favicon.png`, `/apple-touch-icon.png`. The existing image loader advances only on failure and stops on success. There is no webpage parsing, proxy, new permission, runtime dependency, database write or data migration.

This is deliberately best-effort. Icons hosted at arbitrary paths, authentication requirements and network failures still fall back to the site's initial. A read-only network diagnostic across 26 collection origins found 10 root ICO responses with image MIME types, one additional origin recoverable by these fallback paths, and 15 without a successful image response within the diagnostic's four-second per-request limit. These are observations from this network session, not a claim that those sites lack favicons.

## Verification

- 73 frontend tests passed; TypeScript project check passed.
- `scripts/verify-favicon-fallback.js`: isolated fixtures verified SVG, PNG and Apple-touch recovery, saved icon priority, ordered failures, stopping after success, and a stable initial after all candidates fail. No runtime page errors; no real collection writes.
- `scripts/verify-card-refresh.js`: card regression passed at 320/390/768/1024/1440, with hover, keyboard, copy, multi-drag, equal heights, quiet borders, list layout, touch controls, dark-blue theme and reduced motion.
- Extension helper regenerated from the canonical TypeScript source; no manifest or permission change.
- No React component, Arc primitive, CSS, animation or window engine changed. Existing Arc design language and product exceptions are unchanged. There is no configured lint task.

## Deployment

The running desktop executable embeds its frontend, so development-server verification does not update it. Build a ready artifact and replace the root executable only after the user exits StashDock from the tray. Do not force termination or imply that the running production UI already contains this change.

- Windows release/NSIS build passed. All nine embedded application icon sizes match the brand. Existing LNK4099 warnings concern missing Microsoft PDB debug symbols.
- Ready executable: `artifacts/stashdock-favicon-fallback.exe`, SHA256 `988A078836B63B1A8CECCF4CD3200D31F19E42EB14F39760DA4682F62F501BE0`.
- Ready installer: `artifacts/StashDock_0.2.1_favicon-fallback_x64-setup.exe`, SHA256 `D6D71D9C4FA602A944B79DB059870BBD6CC579557DF3D2BC5AD2028DEFE4685A`.
- After the user confirmed tray exit, verified no StashDock process remained. Backed up the prior root executable to `artifacts/stashdock-before-favicon-fallback.exe`, verified SHA256 `1E5323A9C80E73A516330B1641C8564E7DD8CDEB35B1CED61A8B6CF43F35A6A6`, then replaced the root executable with the verified ready artifact.
- Root executable now has SHA256 `988A078836B63B1A8CECCF4CD3200D31F19E42EB14F39760DA4682F62F501BE0`; launched it from `D:/StashDock/stashdock.exe`, PID43136. No forced termination, installer execution or collection writes.
- Read-only runtime verification passed: bridge health available, 30 references/16 previews, and the served embedded frontend includes all four favicon fallback paths. Browser recovery/regression tests above cover the image loader; this deployment check is not a new native visual test.
- An already-open Codex shelf must be refreshed to load the new embedded frontend. Actual recovery remains dependent on each site's icon availability and the user's network.
