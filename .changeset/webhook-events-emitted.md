---
'@strimz/shared-types': minor
'@strimz/shared-config': minor
'@strimz/sdk': minor
---

Remove the `subscription.recovery_outcome`, `refund.failed` and `agent.action_executed` webhook events, which were never sent, along with their envelope schemas and the `SubscriptionRecoveryOutcomeEvent`, `RefundFailedEvent` and `AgentActionExecutedEvent` types. `payment.created` and `subscription.recovery_attempt` are now sent.
