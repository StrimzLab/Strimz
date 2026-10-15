---
'@strimz/shared-config': minor
---

Replace the fee tiers with the pricing-page plans: Free 0 bps, Starter 50 bps from 1,000 of all-time volume, Growth 40 bps from 50,000, and Enterprise by contract. New exports: `PLANS`, `planFeeBps`, `planForVolume`, `planIncludes`, `plansWith`, `lowestPlanWith` and `PLAN_FEE_CEILING_BPS`. `planForVolume` counts USDC and EURC separately and moves up when either reaches a threshold. Removed: `TIERS`, `getTier`, `effectiveFeeBps`, the monthly fees and the subscription premium. `MerchantTier` is now `'free' | 'starter' | 'growth' | 'enterprise'`.
