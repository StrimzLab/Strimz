# @strimz/contracts

Strimz smart contracts. On-chain source of truth for merchant identity, payments, subscriptions, fees, and the AI-agent commerce layer. Solidity 0.8.28, Foundry, OpenZeppelin Contracts v5.6.1, OpenZeppelin Foundry Upgrades v0.4.0.

## Architecture

The policy contracts (`StrimzRegistry`, `FeeCollector`,
`TokenWhitelist`, `StrimzAgentRegistry`, `StrimzAgentEscrow`) are
UUPS proxies. Their implementations disable initialisers in the
constructor (annotated with
`/// @custom:oz-upgrades-unsafe-allow constructor`) and expose an
`initialize(...)` that runs once through the proxy.

The two value-moving contracts (`StrimzPayments` and
`StrimzSubscriptions`) are deliberately immutable. Their logic is
fixed at deploy time. A stolen admin key cannot rewrite the code
that moves USDC out of a payer's wallet, because no upgrade path
exists to rewrite.

Every contract reserves a deterministic ERC-7201 storage slot for
its state struct. Upgradeable contracts use this so future versions
can append fields without colliding with existing slots. The
immutable contracts use it too, because their dependency pointers
(Registry, FeeCollector, TokenWhitelist) can still be rotated by
`ADMIN_ROLE` after deploy.

| Contract              | Upgradeable    | Storage namespace                    |
| --------------------- | -------------- | ------------------------------------ |
| `TokenWhitelist`      | UUPS           | `strimz.storage.TokenWhitelist`      |
| `FeeCollector`        | UUPS           | `strimz.storage.FeeCollector`        |
| `StrimzRegistry`      | UUPS           | `strimz.storage.StrimzRegistry`      |
| `StrimzPayments`      | No, immutable. | `strimz.storage.StrimzPayments`      |
| `StrimzSubscriptions` | No, immutable. | `strimz.storage.StrimzSubscriptions` |
| `StrimzAgentRegistry` | UUPS           | `strimz.storage.StrimzAgentRegistry` |
| `StrimzAgentEscrow`   | UUPS           | `strimz.storage.StrimzAgentEscrow`   |

**Upgrade authorization.** Where it exists, `_authorizeUpgrade` is
gated by `UPGRADER_ROLE`. In production the role is held by an
OpenZeppelin `TimelockController` (48-hour delay on mainnet)
controlled by a Safe multi-sig. On testnet a single deployer holds
it for development velocity.

**Validated upgrades.** Deploy scripts and the upgrade test go through `openzeppelin-foundry-upgrades`'s `Upgrades.deployUUPSProxy` and `Upgrades.upgradeProxy`. These shell out to the OpenZeppelin upgrades-core CLI (Node) to verify storage-layout compatibility before any deployment or upgrade transaction is broadcast. The validator refuses to ship a V2 whose storage layout would collide with V1.

**Dependency rotation.** Payments and Subscriptions read Registry,
FeeCollector, and TokenWhitelist references from their own
namespaced storage rather than from immutables. The
`setRegistry`, `setFeeCollector`, and `setTokenWhitelist` admin
endpoints let those references rotate without touching the
value-moving logic.

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
├── Verify.s.sol                   Read-only post-deploy state assertion
├── Digests.s.sol                  EIP-712 digest + signing helpers used by e2e.sh
├── e2e.sh                         Live-network smoke test (register → pay → permit → cancel)
├── verify.sh                      Source verification on Arcscan (Blockscout v2)
└── utils/
    ├── ProxyDeploy.sol            Lightweight ERC-1967 proxy helper (used by unit tests)
    └── DeploymentLog.sol          Append-only JSON deployment audit trail
deployments/
└── <chainId>.json                 Append-only deployment history per chain (auto-generated)
```

## Gas posture

| Lever              | Choice                                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| `via_ir`           | `true`. Better optimisation passes.                                            |
| `optimizer_runs`   | `1_000_000`. Runtime-optimal (millions of executions expected).                |
| Custom errors      | Everywhere. ~50% cheaper than revert strings.                                  |
| Struct packing     | `Subscription` packed to 4 slots (was 5); `Merchant` packed to 2 slots         |
| Hot-path locals    | Subscription charge caches `payer`, `amount`, `token` to avoid repeated SLOADs |
| `unchecked` blocks | Loop counters and provably-safe arithmetic                                     |
| `calldata` arrays  | `batchCharge` reads input arrays from calldata, no memory copy                 |
| Indexed events     | Up to 3 indexed fields where downstream filters benefit                        |

## Security posture

- **Enums begin with `None`.** `ChargeOutcome` and `JobStatus` reserve index 0 for `None`, so the default value of an uninitialised storage slot is never a valid state. Reading an unset slot as `Charged` or `Proposed` would be a silent value-leak vulnerability.
- **Contract-level charge idempotency.** Every subscription charge carries a unique `chargeAttemptId` (bytes32). The contract rejects reuse. Double-charging is structurally impossible even if the off-chain scheduler crashes mid-batch.
- **Owner-pausable kill switch.** Every value-moving function respects `Pausable`. `ADMIN_ROLE` can halt all transfers in a single call.
- **Reentrancy guards** on every value-moving function (`pay`, `withdraw`, `batchCharge`, `fundJob`, `approveAndRelease`, `cancelJob`).
- **Storage-safety validation** at deploy and upgrade time. `Upgrades.deployUUPSProxy` and `Upgrades.upgradeProxy` will fail loudly before any chain transaction if the new bytecode is incompatible.
- **No `tx.origin`. No `delegatecall` outside OZ-vetted UUPS plumbing. No assembly outside the ERC-7201 storage-slot helper.**

## Deployment flow

1. Build the project with full storage layouts (`forge build`).
2. The plugin validates each implementation against its predecessor (if any) before deploying.
3. Deploy each ERC-1967 proxy, calling `initialize(...)` via the proxy's constructor in one transaction (atomic, with no front-running window).
4. Wire roles between proxies (e.g. grant `FEE_ACCRUER_ROLE` on `FeeCollector` to `Payments` and `Subscriptions`).
5. Seed the token whitelist with the Arc USDC / EURC addresses.
6. Append a record to `deployments/<chainId>.json`.

`script/DeployCore.s.sol` does steps 1 to 6 atomically. `script/DeployAgent.s.sol` does the same for the agent layer.

## Live deployment (Arc Testnet)

Chain id `5042002`. Explorer: <https://testnet.arcscan.app>.
Source for upgradeable contracts is verified at the **implementation**
address; the proxy renders it automatically once Blockscout indexes
the impl. The two immutable contracts have `proxy == implementation`.

| Contract            | Address (proxy)                                                                                 | Implementation                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| StrimzRegistry      | [`0x272c…0e77`](https://testnet.arcscan.app/address/0x272c7218ccceebd62a04e284091e0bc702b60e77) | [`0x1d75…696d`](https://testnet.arcscan.app/address/0x1d7542507aa51fe37d4bd0455742632d76b7696d)  |
| TokenWhitelist      | [`0x8ae2…e0f5`](https://testnet.arcscan.app/address/0x8ae2bae922b7e16a8a55dc1b583960d4c651e0f5) | [`0x274b…a8b3`](https://testnet.arcscan.app/address/0x274b5b124a55ddbd2b6e0055ff9684abaf38a8b3)  |
| FeeCollector        | [`0x76c0…eb77`](https://testnet.arcscan.app/address/0x76c01321be97b25cc6a302457e61d148761beb77) | [`0x1616…2f1e`](https://testnet.arcscan.app/address/0x1616e3b0734af6e07661082be1eca2585b1d2f1e)  |
| StrimzPayments      | [`0x3f99…9ca9`](https://testnet.arcscan.app/address/0x3f99a85c6b806ae55027d94bcf5165dc6e0d9ca9) | same as proxy (immutable)                                                                        |
| StrimzSubscriptions | [`0xe5ff…1524`](https://testnet.arcscan.app/address/0xe5ff3431aa8cbb3345a8cd08f8f369f685821524) | same as proxy (immutable)                                                                        |
| StrimzAgentRegistry | [`0xf6b9…3be2`](https://testnet.arcscan.app/address/0xf6b929ee0609885af1610921f79b8349dc0e3be2) | [`0x6b01…b087c`](https://testnet.arcscan.app/address/0x6b0165f95943186fe456e41c344b15317fab087c) |
| StrimzAgentEscrow   | [`0xbe9d…ab78`](https://testnet.arcscan.app/address/0xbe9d797bb1cbce2ed1358af7e105d9c231daab78) | [`0xa47c…4923`](https://testnet.arcscan.app/address/0xa47c43b9be423e1e296ba6fc8caef804fcaa4923)  |

When sending txs (or pasting addresses into the SDK / API), always
use the **proxy** column. The implementation column is only for
viewing verified source on Arcscan.

Native USDC on Arc lives at `0x3600000000000000000000000000000000000000`.

## Deploying to Arc

These steps take you from a clean checkout to a verified deployment
on Arc Testnet. Mainnet is identical except for the `.env` values and
the `--rpc-url` flag.

### 1. One-time setup

Copy the env template and fill it in:

```sh
cd packages/contracts
cp .env.example .env
```

Edit `.env`:

```sh
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
STRIMZ_DEPLOYER_PRIVATE_KEY=0x<your-funded-testnet-deployer-key>
ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
ARC_EURC_ADDRESS=0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a
```

Fund the deployer wallet with Arc-testnet USDC. Gas on Arc is paid
in USDC, not ETH. Faucet: `https://faucet.circle.com`, choose **Arc
testnet**.

### 2. Load the env into your shell

The deploy and verify scripts read addresses from environment
variables. Load every `KEY=value` line from `.env` into the current
shell with one command:

```sh
set -a && source .env && set +a
```

`set -a` makes every variable defined by `source` auto-exported (as
if you wrote `export` in front of every line). `set +a` turns that
mode off again. The variables stay in scope for the rest of the
terminal session; close the terminal and you'll need to run it again.

Sanity check:

```sh
echo "$ARC_TESTNET_RPC_URL"
# → https://rpc.testnet.arc.network
```

### 3. Deploy the core

```sh
forge clean && forge build
forge script script/DeployCore.s.sol \
  --rpc-url arc_testnet --broadcast -vvv
```

> `forge clean && forge build` is needed before any deploy because
> the OpenZeppelin upgrades safety validator rejects build-info from
> a partial compilation. Skip it and the script reverts mid-flight.

This deploys the three UUPS proxies (Registry, TokenWhitelist,
FeeCollector), the two immutable contracts (Payments, Subscriptions),
wires `FEE_ACCRUER_ROLE`, seeds the whitelist with USDC and EURC,
and appends a record to `deployments/<chainId>.json`.

Source verification is a separate step after deploy — see **6b** below.
Forge's `--verify` flag isn't used because its chain-name lookup errors
on custom chain ids (Arc Testnet is 5042002, not in foundry's built-in
enum). `./script/verify.sh` POSTs each implementation's standard JSON
input directly to Blockscout's v2 verification endpoint and works
deterministically.

### 4. Capture the addresses

Read the most recent entry from the deployment log and export each
proxy address. Adjust the chain id if you're deploying to mainnet.

```sh
jq -r '.[-1].contracts[] | "STRIMZ_\(.name | ascii_upcase)_ADDRESS=\(.proxy)"' \
  deployments/5042002.json
```

That prints lines like:

```
STRIMZ_STRIMZREGISTRY_ADDRESS=0x...
STRIMZ_TOKENWHITELIST_ADDRESS=0x...
STRIMZ_FEECOLLECTOR_ADDRESS=0x...
STRIMZ_STRIMZPAYMENTS_ADDRESS=0x...
STRIMZ_STRIMZSUBSCRIPTIONS_ADDRESS=0x...
```

Append the addresses your scripts need to `.env`:

```sh
cat >> .env <<EOF

# Core deployment (chain id 5042002)
STRIMZ_ADMIN_ADDRESS=$(cast wallet address --private-key "$STRIMZ_DEPLOYER_PRIVATE_KEY")
STRIMZ_REGISTRY_ADDRESS=$(jq -r '.[-1].contracts[] | select(.name=="StrimzRegistry") | .proxy' deployments/5042002.json)
STRIMZ_TOKEN_WHITELIST_ADDRESS=$(jq -r '.[-1].contracts[] | select(.name=="TokenWhitelist") | .proxy' deployments/5042002.json)
STRIMZ_FEE_COLLECTOR_ADDRESS=$(jq -r '.[-1].contracts[] | select(.name=="FeeCollector") | .proxy' deployments/5042002.json)
STRIMZ_PAYMENTS_ADDRESS=$(jq -r '.[-1].contracts[] | select(.name=="StrimzPayments") | .proxy' deployments/5042002.json)
STRIMZ_SUBSCRIPTIONS_ADDRESS=$(jq -r '.[-1].contracts[] | select(.name=="StrimzSubscriptions") | .proxy' deployments/5042002.json)
EOF

# Reload so the new variables are live in the current shell.
set -a && source .env && set +a
```

### 5. Deploy the agent layer

`DeployAgent` reads `STRIMZ_TOKEN_WHITELIST_ADDRESS` to wire the
escrow's allowlist dependency:

```sh
forge script script/DeployAgent.s.sol \
  --rpc-url arc_testnet --broadcast -vvv
```

A second entry is appended to `deployments/<chainId>.json` with the
AgentRegistry + AgentEscrow proxies. Source verification is a
separate step — see **6b**.

### 6a. State verification (on-chain wiring)

Read-only check that asserts the deployed contracts are wired
correctly. Costs nothing, fails loud on mismatches:

```sh
forge script script/Verify.s.sol --rpc-url arc_testnet -vvv
```

The script asserts that admin roles, fee-accruer wiring, dependency
pointers, UUPS implementations, and (when seeded) the USDC + EURC
whitelist entries all match the expected post-deploy state. It
reverts loud with a specific message if anything is wrong.

### 6b. Source verification (Arcscan / Blockscout)

```sh
./script/verify.sh                 # verify everything in the log
./script/verify.sh core            # only the core deploy
./script/verify.sh agent           # only the agent deploy
MAINNET=1 ./script/verify.sh       # mainnet RPC + verifier
```

`script/verify.sh` reads `deployments/<chainId>.json`, picks the
most recent entry per label, runs `forge inspect <Contract>
standardJson` to produce a minimal per-contract standard JSON solc
input, and `POST`s it to Blockscout's
`/api/v2/smart-contracts/<addr>/verification/via/standard-input`
endpoint with the `BLOCKSCOUT_API_KEY` as a bearer token.

For UUPS proxies (Registry, TokenWhitelist, FeeCollector,
AgentRegistry, AgentEscrow) only the impl is submitted; once
Blockscout has the impl's source it auto-detects the ERC-1967 slot
(`get_address_info` already reports `proxy_type: "eip1967"` and the
linked implementation) and renders the proxy with the impl's ABI.
The two immutable contracts (Payments, Subscriptions) have
`proxy == implementation`, so they're verified once at that single
address. Constructor args are auto-detected by Blockscout from the
creation tx — no manual abi-encoding step.

Expected tail of the output:

```
[ok] StrimzRegistry      [DEFAULT_ADMIN_ROLE]
[ok] TokenWhitelist      [DEFAULT_ADMIN_ROLE]
[ok] FeeCollector        [DEFAULT_ADMIN_ROLE]
[ok] StrimzPayments      [DEFAULT_ADMIN_ROLE]
[ok] StrimzSubscriptions [DEFAULT_ADMIN_ROLE]
[ok] FeeCollector.FEE_ACCRUER_ROLE -> Payments
[ok] FeeCollector.FEE_ACCRUER_ROLE -> Subscriptions
[ok] dependency pointers wired on Payments + Subscriptions
[ok] UUPS proxies have implementations set
[ok] USDC whitelisted: 0x3600...
[ok] EURC whitelisted: 0x89B5...
=== all checks passed ===
```

### 7. Run the end-to-end smoke test (optional but recommended)

`script/e2e.sh` drives the same flows the hosted checkout produces
against the live deployment: register a fresh merchant, pay via
classic `pay()`, pay via EIP-3009 `payWithAuthorization`, enrol a
subscription via EIP-2612 `permitAndCreateSubscription`, then cancel.
Each stage reads balances and struct fields back via `cast call` and
asserts every observable effect (balance deltas exact to the wei,
auth nonce consumed, subscription stored intact, cancellation flag
flipped).

**Why a shell driver, not a forge script.** Arc installs its native
USDC, blocklist, system-accounting, call-from, and PQ-signature
behaviours as protocol-level precompiles at `0x1800..0000` through
`0x1800..0004`. Foundry's local EVM doesn't know about them, so
`forge script --broadcast` reverts in the local simulation before any
transaction can be built (USDC's `transferFrom` invokes the first two
precompiles per call). `cast send` bypasses the local sim entirely
and submits straight to the RPC, where the precompiles are real.
This is the same approach Arc's own deploy tutorial uses.

`script/Digests.s.sol` handles the EIP-712 work in Solidity (where
typed-data hashing is trivial). It reads the payer key from
`STRIMZ_PAYER_PRIVATE_KEY` at runtime, builds the digest from live
USDC state, signs locally via `vm.sign`, and emits the (v, r, s)
markers the shell greps out and feeds to `cast send`.

**Three distinct actors.** This mirrors the production authorization
model. Strimz (the deployer key) holds `MERCHANT_REGISTRAR_ROLE` and
calls `registerMerchant` on the merchant's behalf, then acts as the
relayer for the meta-tx submissions in stages 3 and 4. The merchant
is the business onboarding on Strimz — their wallet is recorded as
the merchant entry's `owner` and is the only address (besides the
payer) that can cancel an active subscription. The payer is the
merchant's customer. They sign EIP-3009 and EIP-2612 messages but
never broadcast a transaction except for the stage-2 `approve`.

The script refuses to run if any two of the three keys resolve to
the same address, so role-side asserts cannot accidentally pass for
the wrong reason.

```sh
# Append the new keys + the merchant payout address to .env
cat >> .env <<EOF

# E2E smoke test
STRIMZ_MERCHANT_PRIVATE_KEY=0x<merchant-key>
STRIMZ_PAYER_PRIVATE_KEY=0x<funded-payer-key>
STRIMZ_MERCHANT_PAYOUT_ADDRESS=0x<where-the-merchant-receives>
EOF

set -a && source .env && set +a

./script/e2e.sh
```

**Funding the actors before you run:**

- **Strimz (deployer)** is already funded from the deploy step. It
  pays gas for the registration and for the relayer-broadcast meta-tx
  in stages 3 and 4.
- **Merchant** needs a small amount of USDC for gas. Stage 5 (cancel)
  is the only transaction the merchant broadcasts; budget ~0.05 USDC
  to cover it comfortably.
- **Payer** needs roughly 3 USDC for the actual payments plus ~0.05
  USDC of gas for the stage-2 `approve`. Top up via
  `https://faucet.circle.com` (Arc testnet). The script pre-flights
  this balance and exits early with a clear message if it's short.

Total per run is about $3.10 of testnet USDC, almost all of which
ends up at the merchant payout address.

Expected tail of the output:

```
[1] Strimz registers the merchant
  ok owner = 0x...
  ok feeBps = 200
  ok active = true
  ok payoutAddress = 0x...
[2] Payer pays via classic pay()
  ok payer delta = 1003678 (1000000 payment + 3678 gas)
  ok payout delta = 980000
  ok fee delta = 20000
[3] Payer signs EIP-3009; relayer broadcasts payWithAuthorization
  ok nonce used after submit = true
  ok payer delta = 1000000
  ok payout delta = 980000
  ok fee delta = 20000
[4] Payer signs EIP-2612 permit; relayer broadcasts permitAndCreateSubscription
  ok sub payer = 0x...
  ok sub interval = 3600
  ok sub amount = 1000000
  ok sub cancelled = false
[5] Merchant cancels the subscription from their own wallet
  ok sub cancelled after = true

=== All stages passed ===
```

The script exits non-zero with a precise `FAIL: <reason>` line on
any mismatch. Re-run it cheaply to spot-check after every contract
upgrade or to catch a regression in the signing helpers before
pointing real money at the system.

### 8. Commit the audit trail

The JSON deployment log is the canonical record of what's where:

```sh
git add deployments/<chainId>.json
git commit -m "chore(contracts): record Arc Testnet deployment"
```

## Reading the deployment log

`deployments/<chainId>.json` is a top-level JSON array. One element
per script invocation. Inspect with `jq`:

```sh
# Latest deployment on a chain
jq '.[-1]' deployments/5042002.json

# Just the core proxies of the latest deployment
jq '.[-1].contracts' deployments/5042002.json

# Every "core" deployment in history on this chain
jq '.[] | select(.label == "core")' deployments/5042002.json

# The deployer address of the most recent agent deploy
jq -r '[.[] | select(.label == "agent")] | last | .deployer' deployments/5042002.json
```

Each record carries `timestamp` (Unix seconds), `chainId`,
`deployer` (the EOA `tx.origin` of the script run), `label`
(`"core"`, `"agent"`, etc.), and a `contracts` array of
`{ name, proxy, implementation }` triples. For the two immutable
contracts (Payments, Subscriptions), `proxy` and `implementation`
are the same address — there is no proxy, only the direct deploy.

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
| `BLOCKSCOUT_API_KEY`             | Bearer token for `script/verify.sh`. Get one at `testnet.arcscan.app`.         |
| `ARC_TESTNET_VERIFIER_URL`       | Blockscout v2 base URL — `https://testnet.arcscan.app/api/`                    |
| `ARC_MAINNET_VERIFIER_URL`       | Mainnet equivalent — `https://arcscan.app/api/`                                |
| `ARC_USDC_ADDRESS`               | Token whitelist seed. Auto-added by `DeployCore`.                              |
| `ARC_EURC_ADDRESS`               | Token whitelist seed. Auto-added by `DeployCore`.                              |
| `STRIMZ_TOKEN_WHITELIST_ADDRESS` | Whitelist proxy address. Required by `DeployAgent`.                            |

## Audit posture

- Unit tests per contract + a real V1→V2 upgrade test + invariant test.
- The `Upgradeability.t.sol` test goes through the OpenZeppelin Foundry Upgrades validator, so storage compatibility is enforced as part of the test suite rather than only at deploy time.
- No mainnet deploy ships without an independent third-party audit.
- `Pausable` kill switch on every value-moving function so a triaged incident is a one-transaction stop-the-bleed.
- Multi-sig (Safe) controls `DEFAULT_ADMIN_ROLE` and `UPGRADER_ROLE` in production; EOA is acceptable on testnet only.

## Foundry config notes

- `ffi = true` and `ast = true` are required by `openzeppelin-foundry-upgrades`. It shells out to a Node validator and parses the AST for storage layouts.
- `extra_output = ["storageLayout"]` and `build_info = true` ensure the validator has the data it needs.
- The `test` script does `forge clean && forge build` before `forge test` because the OZ validator rejects partial build-info; incremental compiles produce partial output.
- `via_ir = true` is enabled for the better optimiser; this slows compile time but is worthwhile for hot-path contracts.
