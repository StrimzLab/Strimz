---
date: 2026-10-30
feature: Indexer ABI files are generated from the contract build, and CI fails on drift
scope: chore
scenario-impact: none
---

# Indexer: generated ABI files and a drift check

The indexer's embedded ABI files had drifted from the contracts.

- Payments still listed `Upgraded`.
- Five events from the contracts going out with #142 were missing: `TokensRescued` (in both Payments and Subscriptions), `SubscriptionReinstated`, the two Registry fee-increase events, and Payments' `EIP712DomainChanged`.
- The Registry and escrow files were full ABIs, while the other seven contained only events.

A script now writes all nine files from the Foundry build, and CI fails when the committed files differ.

Refs #386 (epic #387). ADR: [ADR-2026-10-30-generated-indexer-abis](../adr/ADR-2026-10-30-generated-indexer-abis.md).

## What shipped

- **`scripts/generate-abis.sh`:**
  - It writes `apps/indexer/internal/abi/<Contract>.abi.json` for the nine contracts the indexer embeds, using the events from `packages/contracts/out`.
  - `--check` compares instead of writing: it prints the diff and exits 1 when anything differs, and it fails if the build output is missing.
  - `make abi` now calls this script.
- **`apps/indexer/internal/abi/deployed-only/StrimzRegistry.events.json`:**
  - It holds `MerchantMaxFeeBpsLowered`. The current testnet Registry can still emit this event, but the source dropped it in #251.
  - The script appends it to the Registry file, so the indexer keeps decoding it.
- **CI:** the `foundry` job runs `scripts/generate-abis.sh --check` right after the build. `scripts/preflight.sh` runs it after its contracts build.
- **Regenerated files:**
  - Registry and escrow are now events-only.
  - Payments drops `Upgraded`. The deployed Payments isn't a proxy, so it never emitted it.
  - The new events are added. The projector acts only on `SubscribedEvents`, so they're decoded but not projected until #142.
- **Docs:** the indexer README describes the script, the check and the deployed-only folder.

## Ships with #142

- **Remove the deployed-only list:** delete `apps/indexer/internal/abi/deployed-only/` and run `scripts/generate-abis.sh`. The retired Registry is the only contract that emits `MerchantMaxFeeBpsLowered`.
- **Relay ABIs (#372):** add their TypeScript output to `scripts/generate-abis.sh`, so the relayer reads the same build.

## Tests

- **Red:** on `main`, `scripts/generate-abis.sh --check` exits 1. Registry, Payments, Subscriptions and escrow differ from the build; the other five already match exactly.
- **Green:** after regenerating, `--check` exits 0, and the indexer tests pass, including the e2e-tagged code under `go vet`.
- **Mutation check:** removing `SubscriptionCharged` from the Subscriptions file makes `--check` exit 1.
- **Subscribed events:** the existing `TestSubscribedTopics_ContainsEverySubscribedEvent` already fails if a subscribed event has no topic in the embedded files, so no new Go test was needed.
- `./scripts/preflight.sh` passes in full.
