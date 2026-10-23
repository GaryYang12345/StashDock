# Restore original Add feedback

## User-approved behavior

One existing Add to chat button only: black Add to chat → temporary green Added confirmation → black Add to chat. No persistent grey state, re-add action, reset menu, or alternative button copy. Pointer actions still follow the existing shared card hover rules; touch and keyboard access remain intact.

Single and bulk Add use the existing Arc Button label/icon animation and the same semantic success class as desktop Copy for AI. Green confirmation lasts 1.8 seconds after the operation settles. Its timer clears on a new addition/unmount. Successful batches remain visible if a later batch fails. Only in-flight work blocks concurrent presses; later deliberate clicks may add the same reference again.

No host draft contents or attachment-removal state is inferred. The native file attachment limitation is unchanged. No host installation or private IPC was modified.

## Verification

- TypeScript build and 208 frontend tests passed.
- Rendered acceptance: black/green/black color and label cycle, disappearance outside hover, native enabled state after feedback, removal from the isolated test composer followed by Add, intentional repeat click and bulk repetition.
- Existing Note scrolling, shared tag hover and inline favicon importer regression retained.
- Additional rendered checks passed at 390px and 1063px in both themes, including reduced motion. Success and restored-button screenshots are under `output/playwright/add-{success,ready}-0426-*.png`.
- Installed plugin smoke check passed for 0.4.26 / shelf-v28. Installed HTML and project bundle have identical SHA-256 hashes.
- Arc checklist: reuse installed Button without internal edits; meaningful semantic success color paired with Added label/check; stable button element; existing shared reduced-motion and responsive hover rules; timer cleanup; no new visible controls or copy.

MCP release 0.4.26 / `ui://stashdock/shelf-v28.html`. Desktop clipboard feedback is unchanged and already uses the same black/green/black pattern; no desktop binary replacement is required for this MCP-only rollback. Rendered checks use disposable fixtures, not the real Codex composer or user collection.
