---
date: 2026-11-11
feature: Merchant on-chain registration is queued again
scope: fix
scenario-impact: none
---

# Merchant registration job id

Finishing onboarding, or creating a payment session, plan or invoice for a merchant not yet
registered on-chain, failed with a 500. The registration job id was
`merchant-register:<merchantId>`, and BullMQ refuses custom ids containing `:`. The id is now
`merchant-register-<merchantId>`, like the other relay keys. The api's test queue now refuses
`:` the same way, so tests catch this.
