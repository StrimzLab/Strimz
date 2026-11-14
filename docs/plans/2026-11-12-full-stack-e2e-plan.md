# Plan: full-stack money-path e2e test (2026-11-12)

No ADR: tests, a test harness and a CI job only. Nothing under any app's `src/`, no
contract, schema, job payload, webhook payload or published package changes.

## Why

Every current e2e suite tests one service with its neighbours stubbed: the api suite
stubs the chain, the scheduler suite stubs the chain service, the indexer store suite
feeds hand-made logs. `packages/contracts/script/e2e.sh` runs the contracts on real
testnet but skips every Strimz service. No test runs a payment from the API, through
the relayer, onto a chain, back through the indexer into Postgres, and out as a
signed webhook. A break in any of those joins (an ABI drift, a column the indexer
writes under a different name, an outbox row the dispatcher ignores) passes every
suite today.

## Approach

Arc's USDC calls protocol precompiles that a plain local EVM lacks, so the harness
runs `arc-anvil --network arc --fork-url $ARC_TESTNET_RPC_URL --chain-id 5042002`, the
same technique `script/rehearse.sh` uses. Chain id 5042002 keeps every app's
validated config on its real testnet path; nothing gets a local-chain branch.

1. Start Postgres 16 and Redis 7 with testcontainers, apply Prisma migrations.
2. Start the fork. Deploy fresh contracts with `DeployCore.s.sol` from anvil keys and
   fund the payer with forked USDC through `anvil_setBalance` (USDC is Arc's native
   balance).
3. Boot the real processes from their builds: api (software signer, anvil key 4 as
   relayer), indexer (pointed at the fresh addresses), scheduler (webhook dispatcher
   and sweeper). The agent is out of scope.
4. Seed one merchant the way the api e2e fixtures do: a `merchants` row, an on-chain
   `registerMerchant` from the deployer, and an `sk_test_` key from
   `@strimz/shared-crypto`. Real sign-up goes through Privy, which a test cannot reach.
5. Deploy from a scratch directory that symlinks the contract sources, so
   `DeployCore` writes its log there and never into the committed
   `deployments/5042002.json`.
6. Seed one webhook endpoint row for `payment.completed` and the subscription events.

## What "webhook" means in this test

The scheduler refuses to deliver to any private or loopback address, at registration
and again at send time (`webhook-target-policy.ts`). That is correct and the test does
not bypass it, so no local receiver can get the HTTP POST. The test follows the chain
up to the socket instead:

1. the indexer writes a `webhook_events` row with the right type and entity,
2. the scheduler dispatches it (`dispatchedAt` set) and creates a delivery for the
   endpoint,
3. the delivery attempt is refused by the target policy, so nothing leaves the machine.

The POST itself, its signature and retries are covered by the scheduler's
`webhook-delivery` e2e suite, which stubs the policy in-process.

## Build order

1. Harness plus scenarios 1 and 2 (one-shot payment). Run green before going on.
2. Scenarios 3 and 4 (subscriptions).
3. Scenario 5 (refund).
4. CI job.

Prior art: `apps/api/scripts/e2e-checkout-payment.mjs` and
`e2e-checkout-subscription.mjs` drive a running stack by hand. They stop at the relay
response and are not run in CI.

## Scenarios

| #   | Flow                                                                                                                                                               | Asserts                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `strimz.paymentSessions.create`, payer signs EIP-3009 and PayIntent with viem exactly as `use-pay-checkout.ts` does, public `POST /v1/checkout/sessions/:id/relay` | tx sent by the relayer; payer, payout and FeeCollector deltas match the fee in base units; session `confirmed`; one `transactions` row; `payment.completed` dispatched to the endpoint and refused by the target policy                                         |
| 2   | Same session relayed again: the identical payload, then a freshly signed one                                                                                       | both answers carry the original tx hash (the durable double-pay guard in `relay.service.ts`); nothing is broadcast; still one transaction row and one `payment.completed` event                                                                                 |
| 3   | Subscription enrolment via permit through `POST /v1/checkout/plans/:id/relay`, then the scheduler's first charge                                                   | subscription projected onto the plan; the charge is sent by the scheduler key and splits fee and net exactly; `subscription.created` and `subscription.charged` dispatched; replaying the same `chargeAttemptId` returns `Duplicate` on-chain and moves nothing |
| 4   | Merchant cancels through `strimz.subscriptions.cancel`                                                                                                             | on-chain `cancelled == true`; `subscription.cancelled` dispatched                                                                                                                                                                                               |
| 5   | Refund through `strimz.refunds.create`, a transfer from the payout wallet, and `submitSignature`, in both orders                                                   | hash posted before the transfer: refund `completed`, payer refunded, `refund.completed` dispatched. Hash posted after the indexer has seen the transfer (the order the refunds guide describes): **fails today**, see below                                     |

Period 2 is not covered: the scheduler decides what is due by the wall clock, the
contract by block time, and moving only the fork's clock leaves the two disagreeing.

## Result

On 2026-11-12, 14 of 15 passed; the failure was the stuck-refund defect. `main` fixed it
in #442 on 2026-11-13, and the branch, rebased onto that, passes 15 of 15. The stress and
chaos suites still fail on purpose for the defects listed in the release note.

## Test accounts

Every account is a fresh random key per run, funded on the fork. The well-known test
mnemonic cannot be used: on Arc testnet almost all of its accounts carry EIP-7702
delegations, so on a fork they have code, and `PayerSignature.isValid` correctly treats
them as ERC-1271 wallets. `fundUsdc` refuses any address that has code.

## Stress suite

`pnpm --filter @strimz/e2e-full-stack test:stress` runs on the same harness with six
merchants. It is run by hand, not in CI. Every limit is a real product limit and is
respected, not raised: 429s are waited out and counted.

| #   | Load                                                                                                    | Must hold                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | `STRESS_PAYMENTS` (150) payments from `STRESS_PAYERS` (10) payers to 5 merchants, all submitted at once | all confirm; one transaction row, tx hash and dispatched `payment.completed` per session; no reverted transactions; payer, payout and FeeCollector totals exact |
| S2  | `STRESS_RACE_ATTEMPTS` (25) differently signed payments for one session at once                         | the payer is charged exactly once                                                                                                                               |
| S3  | `STRESS_SUBSCRIPTIONS` (25) enrolments at once, then the scheduler                                      | each charged exactly once, still once after four more sweeps                                                                                                    |
| S4  | `STRESS_REFUND_ATTEMPTS` (10) refunds of 60% each against one payment at once                           | at most one accepted                                                                                                                                            |

`STRESS_SUBSCRIPTIONS` is capped at 29 because `GET /v1/tokens/:address/permit-nonce`
allows 30 calls an hour per IP, one per enrolment.

## Layout

- `e2e/full-stack/` at the repo root as its own private workspace package
  (`@strimz/e2e-full-stack`). It imports only published packages (`@strimz/sdk`,
  `@strimz/shared-config`, `@strimz/db`) and starts apps as child processes, so no
  app imports another.
- Vitest, one `globalSetup` that owns the containers, the fork and the processes, and
  writes each process's log to a file shown on failure.

## Running

- Local: `pnpm --filter @strimz/e2e-full-stack test` with `ARC_TESTNET_RPC_URL` set.
- CI: a new `e2e-full-stack` job that runs on every pull request. It is **not required**
  for `quality`: a red result is a warning, not a merge block.

## Decision (maintainer, 2026-11-12)

| Question                        | Decision                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| When does it run?               | On every pull request, in CI.                                                                                                     |
| Does a failure block the merge? | No. It shows its result but `quality` does not depend on it.                                                                      |
| Why not required?               | It forks Arc's public testnet, so an Arc outage could fail a PR with nothing wrong in it.                                         |
| When is this revisited?         | After two weeks of runs. Mostly real failures: make it required. Many Arc-outage failures: move it to a nightly schedule instead. |

## Out of scope

The web checkout UI (Playwright already covers its pages), the agent, CCTP and escrow
(hidden for launch), KMS.
