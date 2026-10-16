---
date: 2026-10-10
feature: Dashboard and admin error messages show the API's reason and request id; admin tier refusals show the on-chain fees
scope: fix
scenario-impact: needs_automation
---

# Error messages that say what went wrong

The API answers every error as `{ error: { code, message, requestId?, details? } }`. The
web app's merchant and admin API clients read `code`, `message` and `details` from the
top level of that body, where they never are. Every dashboard and admin error toast said
`Strimz API error <status>`, no screen could branch on an error code
(`merchant_not_synced` never surfaced), the request id was dropped, and the admin page
could not show why #128 refused a tier change.

Issue #228. ADR:
[ADR-2026-10-10-web-api-error-envelope](../adr/ADR-2026-10-10-web-api-error-envelope.md)
([plain-English version](../adr/ADR-2026-10-10-web-api-error-envelope-for-dummies.md)),
accepted with E1 to E3 as recommended.

## What shipped

- One parser, `apiErrorFromResponse`, reads and validates the error envelope with zod for
  both clients. The thrown error carries the API's `code`, `message`, `details` and
  `requestId`. A body that cannot be read keeps the HTTP status and becomes
  `unknown_error` with `request failed with status <n>`.
- The admin write forwarder answers its own two errors (`403 csrf_origin_mismatch`,
  `401 authentication_error`) in the same envelope.
- Error toasts keep their titles and now show the API's message with `(ref <requestId>)`
  underneath.
- The admin merchant page shows a refused tier change under the Tier select: the API's
  message and, for a fee mismatch or a fee above the ceiling, the on-chain merchant id,
  the registry fee, the fee the tier needs and the on-chain ceiling.

## Deploy

Web only; goes live on merge (Vercel). No API change, no migration, no env change.

## Scenario impact

`needs_automation`: covered by web unit tests (`api-error-envelope.test.ts`,
`admin-bff-errors.test.ts`, `api-error-toast.test.ts`, `tier-refusal.test.ts`,
`admin-tier-refusal.test.ts`); `docs/scenarios/` has no scenario to update. After the
deploy, in light and dark mode: on the admin merchant page, pick a tier whose fee does not
match the registry and check the toast shows the API message with a `ref` and the Tier box
lists the fees; on the dashboard, a refused action shows the API's message.
