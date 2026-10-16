---
date: 2026-10-12
feature: Each deployment runs in one mode (testnet test, mainnet live), and the web switches the wallet to Arc before every signature
scope: fix
scenario-impact: none
---

# One chain and one mode per deployment

Fixes #140. ADR:
[ADR-2026-10-12-one-chain-one-mode](../adr/ADR-2026-10-12-one-chain-one-mode.md)
([plain-English version](../adr/ADR-2026-10-12-one-chain-one-mode-for-dummies.md)), W1 to
W4 as recommended (option A: the network decides the mode). Privy, wagmi, withdraw and
the explorer links already followed `NEXT_PUBLIC_ARC_ENVIRONMENT` since #138.

## What shipped

- **Chain guard before signing (W1).**
  - The pay and subscription checkouts, the on-chain policy panel and withdraw call one
    helper, `prepareArcSigning`, before signing.
  - The helper compares the wallet's chain with the configured Arc chain, asks the
    wallet to switch when they differ, and checks again.
  - A declined or failed switch stops the flow with "Switch your wallet to Arc (chain …)
    to continue."
  - The checkout EIP-712 domains use the configured chain id. They used the wallet's
    current chain before.
- **One mode per deployment (W2).**
  - `arcModeFor` (`@strimz/shared-config`, minor): `testnet` → `test`,
    `mainnet` → `live`.
  - **API:**
    - a request with a key of the other mode gets `403 mode_unavailable`;
    - creating or rotating a test key on mainnet gets `403 mode_unavailable`;
    - creating a live key on testnet still gets `403 live_mode_unavailable`, the existing
      documented code;
    - dashboard and Privy sessions run in the deployment's mode and ignore
      `x-strimz-mode`;
    - storefront checkouts create sessions in the deployment's mode, where before they
      were always `live`.
  - **Web:**
    - the Test/Live toggle is a fixed label;
    - the API keys and webhooks dialogs offer only the deployment's mode;
    - the browser-stored mode is gone.
- **Sandbox (W3).** New runbook `docs/runbooks/live-and-sandbox-deployments.md`. It
  covers the live and sandbox deployments and the mainnet launch steps.
- **Docs.** `authentication.mdx` and `errors.mdx` describe both deployments and
  `mode_unavailable`.

## Operator steps

- **Testnet:** nothing required. The dashboard now shows Test only.
  - Storefront sessions stored as `live` before this release no longer appear.
  - The runbook's "Existing testnet rows" section has an optional SQL that moves them to
    `test` (W4). Run it on the testnet database only.
- **Mainnet launch:** follow the runbook. It sets up a second deployment for live mode,
  separate from the sandbox.

## Verification

- **Red before the change:**
  - API e2e `deployment-mode.e2e.test.ts`: 6 of 6;
  - shared-config `mode.test.ts`: 2 of 2;
  - web `arc-signing.test.ts` (4) and `dashboard-mode.test.ts` (2): 6 of 6.
- **Green:** API unit 267 and e2e 320; web 309; shared-config 23.
- **Changed fixtures, assertions unchanged:**
  - in `api-key-scope-enforcement.e2e.test.ts`, "still mints a test key for a merchant
    that is not eligible" now runs on testnet;
  - in `storefront-checkout.e2e.test.ts`, the unlimited-stock test cancels with a test
    key.
- `./scripts/preflight.sh` in full.
- **Still to do after the next testnet redeploy:** the dashboard shows Test with no
  toggle, a payer with a wallet on another network is asked to switch, and a checkout
  completes.
