# ADR: The scheduler can cancel a subscription on chain for the merchant

- **Status:** Accepted (approved by the maintainer, 2026-10-17)
- **Date:** 2026-10-17
- **Issue:** #293
- **Scope:**
  - `packages/contracts`: `StrimzSubscriptions.cancel` also accepts a `CHARGER_ROLE` holder.
    Contract change, so it goes in the #147 re-review and only takes effect with the #142 redeploy.
  - `apps/scheduler`: the cancel job skips a subscription that is already cancelled on chain.
  - `apps/api`: one wrong doc comment on `SubscriptionsService.cancel`.
  - Cancellation docs.
  - No ABI signature, migration, queue payload or webhook payload change.

## Context

Checked against `main` at `e69670f`.

1. **The API cancel queues an on-chain cancel.** `POST /v1/subscriptions/:id/cancel` marks the row
   `cancelled`, fires `subscription.cancelled`, and enqueues `subscription.cancel-onchain`
   (`subscriptions.service.ts:87-133`).
2. **The scheduler signs it with its own key.** `AgentActionWorker.cancelSubscription` calls
   `ChainService.cancelSubscription`, which sends `cancel(id)` from the scheduler account.
3. **The contract refuses that key.** `cancel` allows only the payer or the registry merchant owner
   (`StrimzSubscriptions.sol:310-323`). The scheduler is neither, so every API cancel reverts with
   `Subscriptions__NotSubscriptionParty`, and the job fails and retries.
4. **What that leaves.** Charging stops, because the sweeper skips cancelled rows. But the chain
   still shows the subscription live, `isChargeDue` can return true, and anything holding
   `CHARGER_ROLE` could still charge it. The DB and the chain disagree, and the docs carry a
   "Not yet … #293" note.
5. **The scheduler already holds `CHARGER_ROLE`** on Subscriptions (`AdminHandoff.sol:152`). The
   role's NatSpec is "scheduled charging and agent action endpoints". It can charge any due
   subscription, which is a bigger power than stopping one.
6. **Subscriptions is immutable.** It is a direct deploy, not a proxy (`DeployCore.s.sol`), so a
   contract fix is live only after a redeploy. #142 (testnet redeploy) and #147 (external
   re-review) are both open and not done yet.
7. The API's comment says the worker "reverts the DB flag and surfaces the failure via
   `subscription.charge_failed`" when the on-chain cancel fails. No such code exists.

## Decision

1. **Contract:** `cancel` accepts the payer, the merchant owner, or a `CHARGER_ROLE` holder. Every
   other rule stays: an unknown id reverts, a second cancel reverts with
   `Subscriptions__AlreadyCancelled`, and `SubscriptionCancelled(id, msg.sender)` is emitted. The
   interface NatSpec says who may cancel.
2. **Reuse `CHARGER_ROLE` rather than add a role.** The same scheduler key would hold a new role
   anyway, and reusing it changes no deploy, handoff or verify tooling. Cancelling can't move funds;
   it only stops future charges, which the scheduler already controls off chain.
3. **Scheduler:** before sending, the worker reads `getSubscription(id).cancelled`. If the payer or
   merchant already cancelled on chain, it returns without a transaction instead of reverting with
   `AlreadyCancelled` and retrying.
4. **API:** the cancel comment says what happens: the row is final, and the on-chain cancel is a
   queued follow-up.
5. **Docs:** the cancellation page, API reference, API subscriptions, subscriptions guide,
   dashboard subscriptions, self-serve cancel recipe and self-hosting scheduler pages drop
   "Not yet … #293". It says the API cancel also cancels on
   chain from the subscriptions contract deployed by #142, and that the current testnet deployment
   still reverts it until then.

```
merchant ─► POST /v1/subscriptions/:id/cancel ─► row cancelled + subscription.cancelled webhook
                                              └► queue subscription.cancel-onchain
scheduler worker ─► getSubscription(id).cancelled ? ── yes ─► done, no tx
                                                    └─ no ──► cancel(id) as CHARGER_ROLE ─► SubscriptionCancelled
indexer ─► MarkSubscriptionCancelled (row already cancelled, keeps the API's reason)
```

## Trade-offs

- **Contract change instead of off-chain only.** Leaving the chain live would mean the payer's
  authorisation outlives the cancel, protected only by the scheduler's own DB check. A contract
  fix makes the chain enforce it. It costs nothing extra, because #142 redeploys Subscriptions
  before mainnet anyway.
- **Not a dashboard wallet prompt.** Making the merchant owner sign would keep the contract as it
  is, but an API cancel from a merchant's backend has no wallet to sign with.
- **Shared role.** A leaked scheduler key could cancel subscriptions. It could already charge them,
  and the admin can revoke the role. A separate `CANCELLER_ROLE` would add tooling and no real
  separation while one key holds both.
- **Until the redeploy** the old contract still reverts, so the job keeps failing on the current
  testnet deployment. The docs say so.

## Tests (red first)

1. `packages/contracts/test/StrimzSubscriptions.t.sol`:
   - a `CHARGER_ROLE` holder cancels a subscription, and the event names it as `by`. Reverts with
     `NotSubscriptionParty` on `main`.
   - after the charger cancels, `batchCharge` returns `Cancelled` for it.
   - a charger's second cancel reverts with `AlreadyCancelled`.
   - the existing third-party test still reverts.
2. `apps/scheduler/test/e2e/agent-action.e2e.test.ts`: when the chain reports the subscription
   already cancelled, the job sends no `cancel` and returns without a tx hash. On `main` it sends
   one.
