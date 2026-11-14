---
date: 2026-11-12
feature: A test that runs payments, subscriptions and refunds through every Strimz service at once
scope: chore
scenario-impact: none
---

# Full-stack money-path test

Every e2e suite so far tested one service with the others faked. The new
`@strimz/e2e-full-stack` package (`e2e/full-stack/`) runs the real contracts, api,
indexer and scheduler together on a local fork of Arc testnet, and drives them the way
the hosted checkout does. Plan: `docs/plans/2026-11-12-full-stack-e2e-plan.md`.

It covers, with exact base-unit balance checks:

- a one-shot checkout payment, its fee split, the indexed session and transaction, and
  the `payment.completed` dispatch;
- the double-pay guard: an identical replay and a freshly signed replay both return the
  original payment and broadcast nothing;
- subscription enrolment, the scheduler's first charge, an on-chain `Duplicate` for a
  replayed charge, and a merchant cancel;
- merchant refunds.

Webhooks are followed up to the socket: the scheduler refuses the loopback endpoint, as
its SSRF policy requires, so nothing is sent off the machine.

The suite deploys from a scratch copy of the contracts package, so the committed
`deployments/5042002.json` is never written.

## CI

A new `e2e-full-stack` job runs on every pull request. It is not part of `quality`, so a
failure warns and does not block a merge. It is reviewed after two weeks of runs.

## Stress suite

`pnpm --filter @strimz/e2e-full-stack test:stress` (run by hand, not in CI) fires the
money paths concurrently on the same harness with six merchants. Results on 2026-11-12,
on a local fork:

| Scenario                                                   | Result                                                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| S1: 150 payments, 10 payers, 5 merchants, all at once      | all confirmed once; totals exact to the base unit; 0 reverted; accepted in 16 s, confirmed and indexed p50 65 s, p95 87 s |
| S2: 25 differently signed payments for one session at once | charged once; 24 refused `attempt_in_progress`, 0 reverted                                                                |
| S3: 25 enrolments at once, then the scheduler              | each charged once, still once after four more sweeps                                                                      |
| S4: 10 refunds of 60% at once against one payment          | **fails**: 7 accepted, 420% of the payment reserved                                                                       |
| S1 at 600 payments                                         | **the api answered 500** to every request for about 45 s, see below                                                       |

The test accounts are fresh random keys per run. The public test mnemonic's accounts
carry EIP-7702 delegations on Arc testnet, so on a fork they have code and sign as
smart wallets; `script/rehearse.sh` and `script/e2e.sh` still use that mnemonic.

## Defects found

1. **Refunds stuck in `submitted`.** Fixed on `main` by #442 while this branch was open.
   `refund.e2e.test.ts` reproduced it and now passes against that fix, in both orders.
2. **Refund cap race** (stress S4, fails on purpose). `RefundsService.create` reads the
   existing refunds, then inserts, with no lock, so concurrent requests all pass the cap.
   Red api test and ADR pair on `fix/refund-cap-race`.
3. **Global rate limit answers 500.** `@fastify/rate-limit` (600 requests a minute per
   IP, `main.ts:45`) throws an error that `AllExceptionsFilter` does not recognise, so
   callers get `500 api_error` with no retry hint, and it is logged as an error. Red api
   test and ADR pair on `fix/global-rate-limit-429`.
4. **Webhook outbox loses claimed events on restart** (chaos suite, fails on purpose).
   The dispatcher sets `dispatchedAt` when it claims a batch of up to 100, before
   hydrating them, and nothing reclaims a claim. `chaos/outbox-crash.chaos.test.ts`
   SIGKILLs the scheduler inside that window and restarts it: the `payment.completed` is
   never delivered and no error is recorded. Red scheduler test and ADR pair on
   `fix/webhook-outbox-reclaim`.
5. **The per-route rate limit gives no retry hint** (not fixed; needs its own decision).
   `@RateLimit` answers `429 rate_limited` without a `Retry-After` header, and the
   `retryAfterSec` it sets is dropped by `AllExceptionsFilter`. At 600 payments, 853
   `429`s from `relay.payments` (60 a minute per merchant) carried no hint; the SDK falls
   back to exponential backoff. The stress client does the same and counts them.

With the three fix branches applied together, the stress suite passes (S4: 1 of 10
refunds accepted) and so does the chaos suite; without them, both still fail.

## Chaos suite

`pnpm --filter @strimz/e2e-full-stack test:chaos` (run by hand) kills and restarts
services, so it runs on its own. It holds a table lock so the dispatcher blocks while
hydrating an event, waits until a backend is queued on that lock, then kills the
scheduler there, so the crash lands in the same place every run whatever the dispatcher
design.

## Capacity notes

- The relayer sends one transaction at a time (`relay.processor.ts`, `concurrency: 1`),
  waiting for each receipt: about 1.7 payments a second here. The checkout page stops
  polling after 120 s, so at roughly 200 or more payments queued at once, later payers
  see a timeout although their payment still lands.
- `GET /v1/tokens/:address/permit-nonce` allows 30 calls an hour per IP, one per
  subscription checkout, so 30 subscribers an hour behind one office or carrier IP.
- The per-route limiter keeps its counts in memory, so with several api replicas each
  limit is multiplied by the replica count.
