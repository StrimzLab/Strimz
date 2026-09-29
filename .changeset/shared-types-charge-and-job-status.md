---
'@strimz/shared-types': patch
---

Document enum values that first shipped in 0.3.1 without a changelog entry.

`subscriptionChargeOutcomeSchema` accepts six more outcomes: `not_due`, `ended`, `duplicate`, `unknown`, `merchant_inactive` and `transfer_failed`. `agentJobStatusSchema` accepts three more statuses: `funded`, `resolved` and `reclaimed`.

Code that switches over `SubscriptionChargeOutcome` or `AgentJobStatus` needs a branch for the new values. No code changes in this release.
