# `@strimz/contracts-stellar`

Soroban contracts that mirror the EVM Strimz suite — one-shot
payments, recurring subscriptions, fee accrual + withdrawal. Sized for
the Stellar side of Strimz's chain-agnostic platform.

## Contracts

| Crate                  | Purpose                                                                                                                                                                                                                                       | Mirrors                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `strimz-fee-collector` | Admin-controlled protocol-fee custody on Soroban. Receives fees from `strimz-payments` + `strimz-subscription`; the admin withdraws to a treasury wallet.                                                                                     | EVM `FeeCollector.sol`        |
| `strimz-payments`      | One-shot USDC / EURC payment. The payer authorises a single `pay()` call; the contract atomically splits the amount into a merchant transfer + a fee-collector transfer. Idempotent on a 32-byte `ref_id` so retries can never double-settle. | EVM `StrimzPayments.sol`      |
| `strimz-subscription`  | Recurring charges. The payer pre-authorises a SEP-41 allowance covering N periods; the merchant initiates each `charge()`. Each charge is idempotent on a 32-byte `attempt_id` keyed per subscription.                                        | EVM `StrimzSubscriptions.sol` |

No `StrimzRegistry` analog — on Stellar the merchant's identity is
their smart-wallet contract address (`C…`), captured at onboarding in
`@strimz/stellar-passkey`'s `deriveMerchantWalletAddress`. The
SubscriptionContract stores the merchant address directly in each
`Subscription` row.

## How auth flows

| Operation                             | Authoriser        | How                                                                                                                                                                                                                               |
| ------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pay()`                               | Payer             | `payer.require_auth()` covers both transfers — the SAC's `transfer(payer, …)` shares the same auth context. No separate `approve` needed.                                                                                         |
| `enrol()`                             | Payer             | `payer.require_auth()` records the subscription. No money moves at this step; the SEP-41 allowance must be set by the payer separately (before or after enrolment — either works as long as it's in place by the first `charge`). |
| `charge()`                            | Merchant          | The merchant initiates; the SEP-41 allowance (granted at enrolment) authorises the SAC's `transfer_from`. The merchant cannot exceed the per-period amount or the allowance.                                                      |
| `cancel()`                            | Payer OR merchant | Either lifecycle endpoint can cancel — both are valid.                                                                                                                                                                            |
| `withdraw()`                          | Admin             | Fee collector only.                                                                                                                                                                                                               |
| `set_admin()` / `set_fee_collector()` | Admin             | One-way rotation.                                                                                                                                                                                                                 |

## Idempotency

Both `pay()` and `charge()` consume a 32-byte idempotency key
(`ref_id` on payments, `attempt_id` on subscription). The contract
records consumed keys in **persistent** storage; a re-broadcast (e.g.
the relayer retrying a transaction) or a malicious replay converges
on `Error::AlreadySettled` / `Error::AlreadyCharged`. Persistent
storage TTL is bumped on every read so a subscription's full life of
attempt rows stays addressable.

## Events

Every state change emits an event the off-chain indexer projects into
Postgres. Topics are namespaced under `strimz_v1` so the projector
can subscribe with a single filter.

| Topic                    | Payload                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `(strimz_v1, payment)`   | `(ref_id, payer, merchant, asset, amount, fee, net)`                |
| `(strimz_v1, sub_enrol)` | `(subscription_id, payer, merchant, asset, amount, period_seconds)` |
| `(strimz_v1, sub_chrg)`  | `(subscription_id, attempt_id, period_end_at, amount, fee, net)`    |
| `(strimz_v1, sub_canc)`  | `(subscription_id, cancelled_by)`                                   |
| `(strimz_v1, fee_w)`     | `(asset, to, amount)`                                               |
| `(strimz_v1, admin_rot)` | `(previous, next)`                                                  |

## Build, test, deploy

```sh
# Native (fast feedback)
make test

# Release WASM into out/
make build

# Format + clippy
make lint

# Deploy to testnet — requires `stellar` CLI authenticated for an
# identity called `strimz-deployer` and funded with XLM. Pubnet works
# the same with `make deploy-pubnet`.
make deploy-testnet
```

`make build` produces three release-mode WASM binaries:

```
out/strimz-fee-collector.wasm   ~9 KB
out/strimz-payments.wasm        ~12 KB
out/strimz-subscription.wasm    ~20 KB
```

Total ~41 KB. Stellar's ledger storage cost scales with these bytes,
so the release profile is tuned aggressively (`opt-level = "z"`,
`lto = true`, `strip = "symbols"`) — bumping these requires re-uploading
the WASM, which is the load-bearing on-chain operation.

`make deploy-testnet` writes a `deploy-testnet.env` file with
`STRIMZ_FEE_COLLECTOR_HASH`, `STRIMZ_FEE_COLLECTOR_ID`, etc. These
become the `rpcConfig` entries on the `SupportedChain` rows in the M1
chain registry — the M5 Stellar adapter reads them at runtime.

## Tests

```
running 18 tests across 3 contracts:
  strimz-fee-collector: 7 (init, admin, withdraw, rotation, balance)
  strimz-payments:      6 (pay, fee split, replay, validation, rotation)
  strimz-subscription:  5 (enrol, charge, replay, cancel, auth)
```

Coverage is the contract's threat model — happy path, replay attempts,
unauthorized callers, zero-amount + overflow edges. Each `should_panic`
test asserts the specific contract error code (or the host-level
`Auth/InvalidAction` when the auth check fires before our `Result`
branch).

## Versioning + upgrade posture

These contracts are **immutable** — Soroban supports contract upgrades
via the host's `update_current_contract_wasm` operation, but Strimz
deliberately doesn't expose an admin function that calls it. Policy
contracts (e.g. fee collector's `set_admin`) remain rotatable; the
value-moving path is closed against upgrade-as-attack.

If a vulnerability surfaces, the remediation is to deploy a fresh
WASM at a new contract id and rotate the off-chain
`SupportedChain.rpcConfig.subscriptionContract` pointer. The Strimz
indexer keeps reading events from the old contract until the migration
window closes; subscriptions in flight at cutover need merchant
cooperation to re-enrol.

## Audit + mainnet

Mainnet (pubnet) deploy is gated on:

1. An independent third-party audit of these three crates. Same posture
   as the EVM contracts.
2. Circle Compliance Engine integration completed (Strimz API screens
   addresses before relaying any tx to either chain).
3. Stellar testnet soak: at least 30 days of continuous payments +
   subscriptions running through the testnet deployment, with zero
   `Error::AlreadySettled` / `AlreadyCharged` triggered in production
   traffic (those reverts mean idempotency is doing its job, but they
   should be rare in healthy operation).
