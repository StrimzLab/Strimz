---
date: 2026-10-04
feature: Agent config PATCH changes only the fields it names
scope: fix
scenario-impact: needs_automation
---

# Agent config: a partial update no longer resets other settings

`PATCH /v1/agents/config` now merges the request onto the stored configuration. A field
you do not send keeps its stored value. Before this change, sending one field of a
section (`recovery`, `cashflow` or `commerce`) reset every other field of that section to
its default. In `commerce`, that emptied the approved vendor allowlist, which means "any
vendor allowed", and set the approval threshold back to $1,000.

Closes #197. ADR: [ADR-2026-10-03-agent-config-patch](../adr/ADR-2026-10-03-agent-config-patch.md)
([plain-English version](../adr/ADR-2026-10-03-agent-config-patch-for-dummies.md)).

## Please review your agent settings

If you changed AutoPay Agent settings through the API or the SDK, open the agent settings
in the dashboard and check them, in particular:

- **Commerce approved vendors.** An empty list lets the agent pay any vendor.
- **Commerce human approval threshold.** Jobs below it are approved without you.

A reset wrote the same values as the defaults, so Strimz cannot tell a reset setting from
one you chose, and has not changed any stored setting. Settings changed only from the
dashboard were not affected, because the dashboard always sent whole sections.

## What changed

- A key you leave out keeps its stored value. An empty body or an empty section
  (`{ "cashflow": {} }`) changes nothing.
- `recovery.notificationTemplate` and `commerce.monthlySpendCapUsdCents` can be cleared
  with `null`. Before, `null` was ignored and the old value stayed, also when the field
  was emptied in the dashboard. `null` on any other field is rejected with
  `400 invalid_request`.
- `enabledCapabilities` and `commerce.approvedVendors` are replaced by the array you send.
  `[]` clears them.
- Unknown keys are still ignored.
- The update runs in one transaction that locks the config row, so two updates to
  different fields at the same time both apply.
- If a stored value is no longer valid, the update returns `500 internal_error`, logs the
  merchant id, and writes nothing.

## Packages

`@strimz/shared-types` and `@strimz/sdk` minor. `UpdateAgentConfigInput` accepts every
value it accepted before. `UpdateAgentConfigParsed` has optional nested fields; code
that reads them as always present must handle `undefined`. Older SDK versions get the
corrected behaviour from the API without upgrading.

No database migration.
