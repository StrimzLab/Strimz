# ADR for Dummies: Limit what a stolen scheduler key can do

- **Status:** Accepted 2026-10-29
- **Date:** 2026-10-29

## The Idea

The scheduler is the Strimz server that charges subscriptions. Its key can do two other things, because the product needs them:

- cancel a subscription when a merchant asks for it;
- change a merchant's fee when they move to a new plan.

If someone stole that key, they could cancel every subscription for good, or raise every merchant's fee to 0.5% at once. We keep both features but make the damage limited and fixable.

## What Changes

1. **Cancels by the server can be undone.** When the server cancels a subscription, the Strimz Safe can bring it back within 7 days. A payer or merchant who cancels from their own wallet still cancels for good.
2. **Fee increases wait a day.** When the server raises a merchant's fee (Free to Starter), the new fee starts 24 hours later, and the Safe can stop it in that time. When it lowers a fee (Starter to Growth), the change is instant.

## What People See

- **Payers:** nothing changes. If a subscription is brought back, they're charged once for the current period, never for the gap.
- **Merchants moving from Free to Starter:** the 0.5% fee starts about a day later.
- **Merchants moving from Starter to Growth:** the lower fee starts straight away, as today.
- **Strimz:** an alert for every server cancel, return and scheduled fee rise.

## Important Limitation

- **Redeploy needed:** this takes effect with the testnet redeploy (#142).
- **The undo window is 7 days.** After that, a server cancel is final too.
- **Fees can still go down.** A stolen key could lower fees, which costs Strimz money, not merchants.

## What Does Not Change

- How charges, payments and payouts work.
- Merchants still cancel through the dashboard or the API.
- Plan prices and the 0.5% cap.
