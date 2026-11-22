# ADR-2026-11-22: Launch with live mode only

- **Status:** Accepted 2026-11-22 by the founder
- **Deciders:** the founder
- **Supersedes:** the launch plan in ADR-2026-10-12-one-chain-one-mode, which called for a live deployment and a separate sandbox, and in `docs/runbooks/live-and-sandbox-deployments.md`.

## Context

The October plan launched two deployments: live on Arc mainnet, and a sandbox on Arc testnet with its own database, keys, contracts and merchant accounts. Merchants would sign up on each.

Strimz shares one OVH server with Solva, and a second deployment costs more than it's worth before launch. The founder decided on 2026-11-22:

- live mode only;
- no test mode and no test keys;
- no sandbox deployment or subdomain;
- no simulated payments and no "test webhook" feature.

Merchants who want to try Strimz send a small real payment, for example 1 USDC. The free plan refunds the fee on the first 1,000 USDC, and Strimz pays the network fee, so a self-test costs a merchant almost nothing.

## Decision

1. **One live deployment at launch,** on Arc mainnet. It accepts `sk_live_` and `pk_live_` keys only, which is how a mainnet deployment already behaves.
2. **Nothing a merchant sees mentions test mode.**
   - **Dashboard:**
     - remove the top-bar mode badge;
     - remove the "Mode" field from the create-key dialog and the "Mode" column from the keys table;
     - reword the first-run checklist so it no longer says "test payment" or "test mode".
   - **Docs:**
     - replace "Test mode vs live mode" with "Testing your integration", which explains small real payments;
     - use `sk_live_` and `pk_live_` in all examples;
     - drop every faucet and testnet instruction from merchant pages (self-hosting pages keep theirs);
     - update the glossary and errors table.
3. **Internals stay.** The `mode` columns, `assertDeploymentMode`, and the `mode_unavailable` refusal remain:
   - they keep the testnet build environment working until mainnet;
   - they still refuse any stray `sk_test_` key on mainnet;
   - removing them would be a large change for no benefit to merchants.
4. **The runbook** describes one live deployment. The sandbox steps and hostnames are removed.

## Consequences

- **Good:** one deployment to run, nothing confusing about modes for merchants, and every test exercises the real flow.
- **Cost:** merchants test with real money, a few USDC, and there's no free sandbox for integrators.
- **Risk:** a careless merchant tests against production data. That is acceptable before launch, because a payment is only a transfer the merchant makes to themselves.
- **Later:** a sandbox or simulated test keys can be added if merchants ask for them, with a new ADR.
