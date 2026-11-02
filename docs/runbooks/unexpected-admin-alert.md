# Runbook: an admin alert you didn't expect

Use this when the contract alert email (`[Strimz] Contract alert: …`, sent to `STRIMZ_ADMIN_ALERT_EMAIL`) lists an event nobody on the team planned. Treat it as an incident until you know who sent it.

Every alert links to its transaction on Arcscan. Start there.

## 1. Confirm it

1. Open the transaction from the alert.
2. Check the sender:
   - the Safe;
   - the timelock;
   - the guardian;
   - the relayer;
   - the scheduler;
   - a merchant's owner wallet.
3. Ask in the team channel whether anyone sent it. A planned change has a Safe transaction or a timelock proposal that someone can point to.

If nobody did, continue.

## 2. Stop what is still waiting

| Alert                                    | Waiting for                      | Stop it with                                                         | From                     |
| ---------------------------------------- | -------------------------------- | -------------------------------------------------------------------- | ------------------------ |
| `TimelockController: call scheduled`     | the timelock delay (48h mainnet) | `cancel(id)` on the timelock, with the `Operation` id from the alert | the guardian or the Safe |
| `Merchant payout address change started` | `Takes effect`                   | `adminCancelPayoutChange(merchantId)` on the Registry                | the Safe (`ADMIN_ROLE`)  |
| `Merchant ownership transfer started`    | `Can accept from`                | `adminCancelOwnershipTransfer(merchantId)` on the Registry           | the Safe (`ADMIN_ROLE`)  |
| `Merchant fee increase scheduled`        | `Takes effect`                   | `cancelFeeIncrease(merchantId)` on the Registry                      | the Safe (`ADMIN_ROLE`)  |

**Merchant payout or ownership change:**

- The merchant gets an email at the same time, so contact them first. The change may be theirs.
- A merchant can cancel a payout change themselves under Settings, On-chain policy.
- For an ownership transfer, they reply to the email or write to support, and you cancel it from the Safe.

## 3. Contain what already happened

These take effect at once, so the alert arrives after the fact.

- **`implementation upgraded`:**
  - Pause the money contracts from the Safe or the guardian: `pause()` on Payments, Subscriptions and the agent escrow.
  - Compare the new implementation with the source before you do anything else.
  - Only the timelock can upgrade, so look for the `call executed` alert that preceded it and work out how it was scheduled without anyone noticing.
- **`role granted` to an unknown account:**
  - Revoke it from the Safe, or through the timelock for timelock-only roles.
  - Rotate any key that could have sent it.
- **`paused`:** find out who paused and why before you unpause. Only `ADMIN_ROLE` can unpause.
- **`tokens rescued` that nobody asked for:** only `ADMIN_ROLE` can rescue, so treat it as a compromised Safe or timelock. Follow section 4 for the Safe, and see `docs/runbooks/token-rescue.md` for what a planned rescue looks like.
- **`subscription reinstated` that nobody asked for:** if the merchant or payer wanted it cancelled, they cancel it again; the Safe has no role that cancels subscriptions.
- **Many operator cancels from the scheduler key:** see "Leaked scheduler key" below.

## 4. Rotate keys

Follow `docs/runbooks/kms-signers.md` for the relayer and the scheduler.

- **Safe owner:** if a Safe owner key may be compromised, replace the owner in the Safe before anything else is signed.
- **Guardian:** if the guardian key leaked, the timelock revokes its `CANCELLER_ROLE` and the Safe revokes its `PAUSER_ROLE`.

### Leaked scheduler key

1. Revoke its roles from the Safe: `CHARGER_ROLE` and `SUBSCRIPTION_CANCELLER_ROLE` on Subscriptions, `FEE_MANAGER_ROLE` on the Registry.
2. List the operator cancels since the leak: `SubscriptionCancelled` events where `by` is the scheduler address.
3. Reinstate the ones the merchant didn't request, within 7 days of each cancel: `reinstate(id)` from the Safe. Each one raises a `subscription reinstated` alert and sends the merchant `subscription.reactivated`.
4. Cancel any pending fee increase the key scheduled: `cancelFeeIncrease(merchantId)` from the Safe.
5. Rotate the key as `docs/runbooks/kms-signers.md` describes, and grant the roles to the new address.

## 5. Write it up

Record the transaction hashes, who was contacted and what was cancelled or reverted in the incident log. If an alert was missing or late, open an issue against the indexer or the scheduler.
