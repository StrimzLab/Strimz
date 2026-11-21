---
date: 2026-11-20
feature: Merchants register with a 5% fee ceiling; fee notice policy; Settings fee copy
scope: fix
scenario-impact: none
---

# Merchant fee ceiling at 5%

ADR: [ADR-2026-11-20-merchant-fee-ceiling](../adr/ADR-2026-11-20-merchant-fee-ceiling.md). Ships with the contract redeploy in this PR.

- **Registration:** `registerMerchant` gets `maxFeeBps = 500` from the new `MERCHANT_FEE_CEILING_BPS` in `@strimz/shared-config`, not 50. The fee is still the plan fee. After the redeploy, every merchant registers again on the new registry and gets the 5% ceiling.
- **Docs:** fees follow the plan, can rise only up to the account's 5% ceiling, and any increase that isn't a plan move gets at least 30 days' email notice. See `guides/subscriptions`, `dashboard/settings` and the contracts README.
- **Dashboard (#505):** the Settings Fees panel shows "Current fee" and "Most Strimz can charge". It no longer says merchants can lower the ceiling, which the contract has no way to do.
- **Operations:** a leaked scheduler key could now schedule increases up to 5%. A rise still waits 24 hours, `cancelFeeIncrease` can stop it, and the indexer alerts on `MerchantFeeIncreaseScheduled`. Make sure that alert reaches someone before mainnet.
- **CI fix:** the indexer stream e2e fixture now packs `SubscriptionCreated` with its `intentNonce`.
