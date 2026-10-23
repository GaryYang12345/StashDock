# Add action hover regression (2026-10-14)

## Cause and fix

`McpShelf` set native `disabled` on every other card's Add button during an attachment request. Arc's `.button:disabled` opacity rule had higher specificity than the card's hidden-action rule, so unhovered peer buttons appeared at 52% opacity. This was transient, not a persisted Added state.

Peers now retain their normal Arc primary appearance and hover visibility. `aria-disabled` describes the brief serialized request lock without applying native disabled styling; the existing synchronous flight guard rejects concurrent presses. Only participating cards show Arc loading and temporary green success. Intentional repeat additions remain allowed after completion. Unsupported host capability still has its genuine disabled state and explanatory notice.

Arc review: existing Button props, loading/announcement and success token composition reused; no Arc internals, CSS, layout, copy or motion changed. Desktop Copy already uses focus-preserving loading rather than globally disabling card actions; the save-only extension has no Add cards. Neither needs a product change.

## Verification

- 237 frontend tests passed; TypeScript and production frontend build passed.
- Asset parity check passed; self-contained plugin build passed (1,441,230-byte HTML).
- 99 native tests passed; the OS-clipboard-writing test remained intentionally ignored.
- `verify-add-peer-hover.js`: eight rendered cases (light/dark, 390/1063px, Grid/List), delayed request, peers hidden at opacity 0 and pointer-events none, hovered peers retain their baseline color/opacity, concurrent presses do not reach transport, success/reset and removal/repeat work. Rejection/retry and bulk selected-only success/reset/repeat also passed.
- Pending/success screenshots inspected. These tests use the real packaged shelf with an isolated mock host, not the user's actual conversation. No real composer writes performed.
- Installed plugin smoke confirmed `ui://stashdock/shelf-v36.html`; installed web/server/helper hashes matched their build outputs. Previous affected installed files preserved under `artifacts/add-peer-hover-20261014-before`.
- Live library fingerprint unchanged: 45 references, rows SHA256 `e97232b31a52b3469ad4aef6d83bc80c4e05ca72985e628916d85e9d4dca977e`, pinned tags SHA256 `631ace42cedebec178a4746c4729a517678f180ce38e790094183b4839385864`.
- Installed desktop executable unchanged. Owned fixture server/browser sessions closed; Chrome, Codex and the running standalone application were not terminated.

Build sequencing: the helper embeds `dist` at compile time. The initial parallel frontend/helper attempt failed while Vite replaced that directory; completing the frontend build and then rebuilding the plugin succeeded. Keep those builds sequential.

Reopen the Codex shelf to load the updated template. A host retaining an already running old MCP server may additionally need its connection refreshed.
