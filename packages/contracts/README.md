# @strimz/contracts

Strimz smart contracts — the on-chain source of truth for merchant identity, payments, subscriptions, fees, and the AI-agent commerce layer. Solidity 0.8.28, Foundry, OpenZeppelin Contracts v5.6.1, OpenZeppelin Foundry Upgrades v0.4.0.

## Architecture

Every contract is a **UUPS proxy**. Implementations disable initialisers in their constructors (annotated with `/// @custom:oz-upgrades-unsafe-allow constructor`) and expose an `initialize(...)` that runs once via the proxy.

Each contract reserves a deterministic **ERC-7201 storage slot** for its state struct. Future versions can append fields to that struct or add new storage namespaces with zero risk of collision with existing slots — **no breaks, no data loss on upgrade**.

| Contract              | Storage namespace                    |
| --------------------- | ------------------------------------ |
| `TokenWhitelist`      | `strimz.storage.TokenWhitelist`      |
| `FeeCollector`        | `strimz.storage.FeeCollector`        |
| `StrimzRegistry`      | `strimz.storage.StrimzRegistry`      |
| `StrimzPayments`      | `strimz.storage.StrimzPayments`      |
| `StrimzSubscriptions` | `strimz.storage.StrimzSubscriptions` |
| `StrimzAgentRegistry` | `strimz.storage.StrimzAgentRegistry` |
| `StrimzAgentEscrow`   | `strimz.storage.StrimzAgentEscrow`   |

**Upgrade authorization.** `_authorizeUpgrade` is gated by `UPGRADER_ROLE`. In production this role is held by an OpenZeppelin `TimelockController` (48h delay on mainnet) controlled by a Safe multi-sig. On testnet a single deployer holds it for development velocity.

**Validated upgrades.** Deploy scripts and the upgrade test go through `openzeppelin-foundry-upgrades`'s `Upgrades.deployUUPSProxy` and `Upgrades.upgradeProxy`. These shell out to the OpenZeppelin upgrades-core CLI (Node) to verify storage-layout compatibility before any deployment or upgrade transaction is broadcast. The validator refuses to ship a V2 whose storage layout would collide with V1.

**Dependency rotation.** Payments and Subscriptions read Registry, FeeCollector, and TokenWhitelist references from their own namespaced storage — not from immutables. `setRegistry` / `setFeeCollector` / `setTokenWhitelist` admin endpoints let those references rotate independently from a contract upgrade.

## Layout

```
src/
├── access/
│   ├── StrimzAccessControl.sol    Role constants + OZ AccessControlUpgradeable base
│   └── Pausable.sol               Global kill switch (ADMIN_ROLE)
├── tokens/
│   └── TokenWhitelist.sol         USDC / EURC allowlist
├── fees/
│   └── FeeCollector.sol           Pull-payment fee accumulator
├── core/
│   ├── StrimzRegistry.sol         Merchant directory (owner, payout, feeBps, active)
│   ├── StrimzPayments.sol         One-shot USDC/EURC payments with fee split
│   └── StrimzSubscriptions.sol    Recurring charges with contract-level idempotency
├── agent/
│   ├── StrimzAgentRegistry.sol    ERC-8004 — AI agent identity + reputation
│   └── StrimzAgentEscrow.sol      ERC-8183 — job lifecycle escrow
└── interfaces/                    One interface per public contract
test/
├── *.t.sol                        Per-contract unit tests
├── Upgradeability.t.sol           Validated V1→V2 upgrade with storage-survival assertion
└── invariant/
    └── PaymentsInvariants.t.sol   Bounded-handler invariant: feeCollector.balance <= totalAccrued
script/
├── DeployCore.s.sol               Deploys core proxies + initialises atomically
├── DeployAgent.s.sol              Deploys agent proxies
└── utils/
    ├── ProxyDeploy.sol            Lightweight ERC-1967 proxy helper (used by unit tests)
    └── DeploymentLog.sol          Append-only JSON Lines deployment audit trail
deployments/
└── <chainId>.jsonl                Append-only deployment history per chain (auto-generated)
```

## Gas posture

| Lever              | Choice                                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| `via_ir`           | `true` — better optimisation passes                                            |
| `optimizer_runs`   | `1_000_000` — runtime-optimal (millions of executions expected)                |
| Custom errors      | Everywhere — ~50% cheaper than revert strings                                  |
| Struct packing     | `Subscription` packed to 4 slots (was 5); `Merchant` packed to 2 slots         |
| Hot-path locals    | Subscription charge caches `payer`, `amount`, `token` to avoid repeated SLOADs |
| `unchecked` blocks | Loop counters and provably-safe arithmetic                                     |
| `calldata` arrays  | `batchCharge` reads input arrays from calldata, no memory copy                 |
| Indexed events     | Up to 3 indexed fields where downstream filters benefit                        |

## Security posture

- **Enums begin with `None`.** `ChargeOutcome` and `JobStatus` reserve index 0 for `None` so the default value of an uninitialised storage slot is never a valid state. Reading an unset slot as `Charged` or `Proposed` would be a silent-value-leak vulnerability.
- **Contract-level charge idempotency.** Every subscription charge call carries a unique `chargeAttemptId` (bytes32). The contract rejects reuse — double-charging is structurally impossible even if the off-chain scheduler crashes mid-batch.
- **Owner-pausable kill switch.** Every value-moving function respects `Pausable`. ADMIN_ROLE can halt all transfers in one call.
- **Reentrancy guards** on every value-moving function (`pay`, `withdraw`, `batchCharge`, `fundJob`, `approveAndRelease`, `cancelJob`).
- **Storage-safety validation** at deploy and upgrade time — `Upgrades.deployUUPSProxy` and `Upgrades.upgradeProxy` will fail loudly before any chain transaction if the new bytecode is incompatible.
- **No `tx.origin`. No `delegatecall` outside OZ-vetted UUPS plumbing. No assembly outside the ERC-7201 storage-slot helper.**

## Deployment flow

1. Build the project with full storage layouts (`forge build`).
2. The plugin validates each implementation against its predecessor (if any) before deploying.
3. Deploy each ERC-1967 proxy, calling `initialize(...)` via the proxy's constructor in one transaction (atomic — no front-running window).
4. Wire roles between proxies (e.g. grant `FEE_ACCRUER_ROLE` on `FeeCollector` to `Payments` and `Subscriptions`).
5. Seed the token whitelist with the Arc USDC / EURC addresses.
6. Append a JSON record to `deployments/<chainId>.jsonl`.

`script/DeployCore.s.sol` does steps 1–6 atomically.

## Scripts

| Command                                                | Description                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `pnpm --filter @strimz/contracts build`                | `forge build`                                                             |
| `pnpm --filter @strimz/contracts test`                 | Clean + build + `forge test -vv` (clean is required for the OZ validator) |
| `pnpm --filter @strimz/contracts test:gas`             | `forge test --gas-report`                                                 |
| `pnpm --filter @strimz/contracts coverage`             | `forge coverage --report lcov`                                            |
| `pnpm --filter @strimz/contracts format`               | `forge fmt`                                                               |
| `pnpm --filter @strimz/contracts snapshot`             | `forge snapshot`                                                          |
| `pnpm --filter @strimz/contracts forge:install`        | Install / refresh all submodules                                          |
| `pnpm --filter @strimz/contracts deploy:testnet`       | Deploy core proxies to Arc testnet                                        |
| `pnpm --filter @strimz/contracts deploy:agent:testnet` | Deploy agent proxies to Arc testnet                                       |

## Environment

Copy `.env.example` to `.env`:

| Var                              | Purpose                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `ARC_TESTNET_RPC_URL`            | RPC for testnet deploys (`https://rpc.testnet.arc.network`)                    |
| `ARC_MAINNET_RPC_URL`            | RPC for mainnet deploys                                                        |
| `STRIMZ_DEPLOYER_PRIVATE_KEY`    | Funded deployer. Never commit. Get testnet gas at `https://faucet.circle.com`. |
| `ARCSCAN_API_KEY`                | For `--verify` on ArcScan                                                      |
| `ARC_USDC_ADDRESS`               | Token whitelist seed — auto-added by `DeployCore`                              |
| `ARC_EURC_ADDRESS`               | Token whitelist seed — auto-added by `DeployCore`                              |
| `STRIMZ_TOKEN_WHITELIST_ADDRESS` | Whitelist proxy address — required by `DeployAgent`                            |

## Audit posture

- Unit tests per contract + a real V1→V2 upgrade test + invariant test.
- The `Upgradeability.t.sol` test goes through the OpenZeppelin Foundry Upgrades validator, so storage compatibility is enforced as part of the test suite, not just an off-chain check.
- No mainnet deploy ships without an independent third-party audit.
- `Pausable` kill switch on every value-moving function so a triaged incident is a one-transaction stop-the-bleed.
- Multi-sig (Safe) controls `DEFAULT_ADMIN_ROLE` and `UPGRADER_ROLE` in production; EOA is acceptable on testnet only.

## Foundry config notes

- `ffi = true` and `ast = true` are required by `openzeppelin-foundry-upgrades` — it shells out to a Node validator and parses the AST for storage layouts.
- `extra_output = ["storageLayout"]` and `build_info = true` ensure the validator has the data it needs.
- The `test` script does `forge clean && forge build` before `forge test` because the OZ validator rejects partial build-info; incremental compiles produce partial output.
- `via_ir = true` is enabled for the better optimiser; this slows compile time but is worthwhile for hot-path contracts.
