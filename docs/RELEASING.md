# Release process

## One source repository, platform-specific assets

`GaryYang12345/StashDock` contains Desktop, AI plugins, browser extension sources,
shared UI/domain, tests and development rules. Do not maintain independent copied
applications. macOS adaptations belong here, behind platform boundaries that
preserve Windows behavior.

GitHub Releases carry installers and complete plugin runtimes. Source archives
are for development, not a substitute for an installable plugin. Browser-store
distribution is separate from GitHub publication. Store URLs remain unset until
real listings exist. Claude and Safari remain planned.

The first source tag is `v0.2.5`, containing Desktop 0.2.5, ChatGPT local plugin
0.4.27 and browser extensions 0.4.13. Components have independent versions.
Keep `v<desktop-semver>` release tags compatible with Desktop's update checker.
Use clearly named prereleases for plugin-only work; do not mark an unrelated
plugin version as the latest Desktop release.

## Before publishing

1. Read AGENTS.md. Preserve user data and unrelated work; snapshot before risky
   changes. Never publish recovery snapshots, libraries or browser profiles.
2. Update real destinations in `src-tauri/product-links.json`; never invent store
   links. Build again after changing embedded configuration.
3. Run `npm ci`, `npm run assets:ui:check`, `npm run test:frontend`,
   `npm run desktop:test`, then production Desktop/plugin/extension builds.
   See [runtime packaging](windows-runtime-release.md) for renderer checks.
4. Verify actual production windows and affected UI. Run mutations only in
   disposable libraries. Report Windows-only and host-specific verification limits.
5. Package with `scripts/package-windows-plugin.ps1`; extract the ZIP and run
   `node scripts/verify-plugin-release.mjs <extracted-root>` and
   `node scripts/verify-ai-context-package.mjs <extracted-root>/plugins/stashdock`.
6. Stage only intended source. Run `node scripts/verify-public-source.mjs` against
   the Git index, and inspect `git diff --cached --stat` / `--check` before commit.
   This gate catches common leaks, not every possible secret or licensing issue.

## Assets and provenance

Attach the Windows NSIS installer, complete Windows plugin ZIP, and matching
browser ZIPs. Each browser ZIP has `manifest.json` directly at its root. Unsigned
Firefox is development/temporary only; do not label it a permanent install.

Include `SHA256SUMS.txt`, a small `release.json` recording the exact source commit,
component versions, file sizes and hashes, and the lightweight Mac handoff ZIP.
Create an annotated source tag; publish from that exact commit. Download the
uploaded assets and check hashes before delivery. Never silently replace assets
under an existing tag with changed builds.

After verifying a complete plugin ZIP and committing the baseline, assemble assets:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-github-release.ps1 -PluginArchive "C:\path\to\verified-plugin.zip"
```

The assembler requires a clean source tree and fresh output directory; it does not
replace build, runtime, signature or manual UI verification.

Signing, clean-machine installer acceptance, store approval and macOS notarization
are separate checks, not implied by successful compilation. The first Windows
release has no Authenticode signature. Never advise disabling platform protections.

## Mac handoff

After committing the source baseline, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-mac-handoff.ps1
```

This makes a small guide/rules/Arc Skill ZIP with the exact Git commit, not another
copy of source or Windows binaries. Mac downloads source from GitHub. Read
[the migration start page](MAC_START_HERE.zh-CN.md). Mac changes should use a branch
and return through a pull request; do not overwrite the Windows release tag.
