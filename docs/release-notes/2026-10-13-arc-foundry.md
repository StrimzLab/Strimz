---
date: 2026-10-13
feature: Contracts build and test on Arc Foundry under Arc's rules, fork tests prove payments with real Arc USDC and its blocklist, and the local chain is Arc's own
scope: chore
scenario-impact: none
---

# Arc Foundry for contracts and the local chain

Fixes #244. ADR:
[ADR-2026-10-13-arc-foundry](../adr/ADR-2026-10-13-arc-foundry.md)
([plain-English version](../adr/ADR-2026-10-13-arc-foundry-for-dummies.md)), F1 to F4 as
recommended.

CI installed upstream Foundry. Arc Foundry's README warns that upstream Foundry "will
run your tests against Ethereum rules while reporting them as passing". Arc's rules
(native USDC, the blocklist, value-transfer rules) are also opt-in in Arc Foundry:
`--network arc`.

## What shipped

- **Toolchain (F1).**
  - `scripts/install-arc-foundry.sh` installs Arc Foundry v0.8.0-2 as `arc-forge`,
    `arc-cast` and `arc-anvil`. It covers Linux x86_64, Linux arm64 and macOS Apple
    Silicon, and checks a pinned SHA-256 for each.
  - CI's foundry job and `scripts/preflight.sh` use it: `arc-forge build --sizes` and
    `arc-forge test --network arc`.
  - `foundry-rs/foundry-toolchain` is gone. The contracts' package scripts use
    `arc-forge`.
- **Fork tests (F2).** `packages/contracts/test-fork/`, run by the `fork` profile
  (`out-fork/`, `cache-fork/`) against an Arc testnet fork in CI and in preflight:
  - an EIP-3009 payment through `StrimzPayments` in real Arc USDC, with fee and net
    exact, no residue and the nonce burnt;
  - the native balance read through the 6-decimal ERC-20 view;
  - a payment to a payout on Arc's seeded blocklist (`0x7099…79C8`) reverts with
    `Blocked address`, and the payer keeps the funds;
  - in a `batchCharge`, a blocklisted payout records `TransferFailed` for its row only,
    and the other row is charged.
- **Local chain (F3).**
  - `infra/arc-anvil/Dockerfile` (Ubuntu 24.04; the binaries need glibc 2.39) builds
    `arc-anvil --network arc --chain-id 5042002`.
  - Compose's `anvil` service uses it, with an `arc-cast` healthcheck.
  - The docker workflow builds it and checks the chain id and the USDC system contract.
- **Deploy and verify (F4).** The contracts README documents the toolchain, the fork
  profile, `arc-forge script --network arc` for deploys and
  `arc-forge verify-contract --verifier blockscout` for verification. #142 moves the
  scripts and `verify.sh`.

## Operator steps

- **Developers:** run `scripts/install-arc-foundry.sh` once (it installs to
  `~/.local/bin`, which preflight adds to `PATH`). Preflight stops with that command when
  `arc-forge` is missing. Intel Macs build Arc Foundry from source.
- **Network dependency:** CI and preflight now reach `https://rpc.testnet.arc.io` for the
  fork tests (override with `ARC_TESTNET_RPC_URL`). While it is down, that gate fails.

## Known difference in the local chain

With `--chain-id 5042002`, `arc-anvil` v0.8.0-2 drops Arc's 20 gwei base-fee floor once
blocks are mined: the base fee decays to about 1,000 wei. With the default chain id the
floor holds. Arc's other rules still apply at 5042002; for example, a value transfer to
the zero address fails. Compose keeps 5042002 because the apps sign for shared-config's
testnet. The relayer floors its fee at 20 gwei in code, and real Arc enforces the floor.

## Verification

- **Without `--network arc`:** three of the four fork tests fail. The payment reverts in
  Arc's native-coin precompile; the blocklist cases revert without Arc's reason or
  charge the wrong row.
- **With it:** all four pass.
- **Clean `arc-forge test --network arc`:** 199 of 199.
- **`arc-anvil` image:** serves chain id 5042002 and USDC at `0x3600…` with 6 decimals,
  and `docker compose up anvil` reports healthy.
- `./scripts/preflight.sh` in full on Arc Foundry: all gates passed, including 199 suite
  and 4 fork tests.
