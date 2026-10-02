---
'@strimz/shared-types': minor
'@strimz/sdk': minor
---

Add `subscriptionEnrolmentTermsSchema` and `StrimzBrowserClient.checkout.planTerms(planId, payer)`. The terms carry the `startAt` a payer must sign for a plan: the end of the plan's trial for a payer who has not subscribed to it before, otherwise `0`. `POST /v1/relay/subscriptions` with a `subscriptionInternalId` now rejects terms that differ from the plan with `enrolment_terms_mismatch`.
