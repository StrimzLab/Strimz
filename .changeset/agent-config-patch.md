---
'@strimz/shared-types': minor
'@strimz/sdk': minor
---

`updateAgentConfigInputSchema` no longer fills defaults inside `recovery`, `cashflow` and `commerce`. Every field in those sections is optional, and the parsed value holds exactly the keys the caller sent, so `PATCH /v1/agents/config` changes only the fields it names. `recovery.notificationTemplate` and `commerce.monthlySpendCapUsdCents` accept `null`, which clears them; `null` on any other field is rejected.

`UpdateAgentConfigInput` only widens: every value that compiled before still compiles and still passes `strimz.agents.updateConfig`'s check. `UpdateAgentConfigParsed` narrows: nested fields that were always present are now optional, so code that reads, for example, `parsed.cashflow.anomalySensitivity` as a `string` no longer compiles.

The server-side fix ships with the API, so older SDK versions get the corrected merge without upgrading.
