# Select all restored to the selection bar, 0.4.11

- Restored the shared Arc ghost Select all button to the desktop ContextBar and MCP bottom selection footer. Removed the collection-right action and its extra layout row. It appears after selecting a reference and selects all current filter matches, including unloaded MCP pages.
- Restored narrow-footer wrapping and scrolling clearance. Document preview skeletons and other card behavior are unchanged.
- Arc review: existing documented Button props, semantic tokens/spacing, neutral ghost action, busy/disabled guards, reduced-motion behavior and keyboard semantics retained. No Arc internals or new focus styles. Dense desktop control sizes remain unchanged; mobile touch and native Windows pointer gestures were not automated.
- TypeScript release check passed; 173 frontend tests passed. Both isolated browser regressions passed at 320, 390, 768, 1024 and 1440px in light/neutral and dark/blue themes. Verified footer containment, absence of the upper button, filtered full selection and unchanged test draft with bounded 30+6 attachment batches.
- Windows EXE and NSIS built. Official plugin installation and installed-server read-only check passed for 0.4.11, resource `ui://stashdock/shelf-v13.html`.
- Root StashDock PID 40564 was verified, stopped and replaced under standing user authorization; restarted health endpoint reports ok. Installed and release EXE hashes match: `32C0C358BAAE72DA01F1C0CB2EDAAE0BD01DFCA8EA5803CB243CB433FF3FF979`.
- Recoverable prior binary: `artifacts/stashdock-before-selection-bar-20261011.exe`. Consistent SQLite backup: `artifacts/library-before-selection-bar-20261011.sqlite3`.
- Protected-content fingerprint before/after matches for 32 references: `a2ee3caff69dd5eed860d2d23146765e2b814f8d1e534ec7d0350e5d9c6d8b0c`. Pinned tags unchanged. Own test browser and development servers closed.
- Existing Codex conversations may retain an earlier MCP connection; new conversations use the updated plugin.
