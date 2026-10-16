---
date: 2026-10-10
feature: Compliance screening is explicitly off at launch; a misconfigured provider stops the API, and the docs say what is true
scope: fix
scenario-impact: none
---

# Public endpoint hardening, part 5: compliance scope

`ComplianceService.screen` has no caller, so no wallet is screened. It would also have
failed open: a provider set without a key answered `clear` after a boot warning, and a
provider error came back as status `error` with nothing defining what a caller does with
it. The public docs described a different system: screening at merchant signup and at
payer connect, a Redis cache, Circle Compliance Engine, and a contract that refuses to
settle without a cleared screening. None of that exists.

Part 5 of 5 for #133. ADR:
[ADR-2026-10-10-public-endpoint-hardening](../adr/ADR-2026-10-10-public-endpoint-hardening.md)
([plain-English version](../adr/ADR-2026-10-10-public-endpoint-hardening-for-dummies.md)),
decision 7 (D8 option A, D10). Earlier parts:
[2026-10-10-public-endpoint-hardening](./2026-10-10-public-endpoint-hardening.md),
[2026-10-10-payer-binding](./2026-10-10-payer-binding.md),
[2026-10-10-contact-hardening](./2026-10-10-contact-hardening.md) and
[2026-10-10-signup-bot-check](./2026-10-10-signup-bot-check.md).

## What shipped

- `ComplianceService` throws at construction when `COMPLIANCE_PROVIDER` is `trm` or
  `elliptic` and `COMPLIANCE_API_KEY` is unset, so the API refuses to boot instead of
  screening nothing. With `disabled` it logs `compliance screening disabled` at boot.
- `screen()` returns `blocked: true` for a `blocked` result and for an `error` result. A
  provider that is down or refuses the call blocks the wallet. `screen()` still has no
  caller; this fixes the rule for when one is added (option B).
- `content/docs/concepts/compliance.mdx` is rewritten: Arc's protocol-level USDC
  blocklist and the relay's simulation stop blocklisted payers; Strimz runs no
  third-party screening; the `compliance.wallet_*` webhook events and the SDK's
  `compliance_blocked` code are published but not sent yet.
- The acceptable-use and privacy pages keep "when the compliance integration is enabled"
  and add that it is not enabled today.
- The published types stay as they are (D10), so no changeset.

## Deploy

1. No env change for the default `COMPLIANCE_PROVIDER=disabled`
   (`infra/lightsail/env.example:87`). If the Lightsail env sets `trm` or `elliptic`
   without `COMPLIANCE_API_KEY`, the API will not boot after the redeploy: set the key or
   go back to `disabled`.
2. The docs and legal pages go live on merge (Vercel). The API part reaches production
   at the maintainer's manual Lightsail redeploy. No migration.

## Scenario impact

`none`: no flow changes; screening was not called before and is not called now. Covered
by API unit tests (`compliance-config.test.ts`, `compliance-screen.test.ts`). After the
redeploy, `docker logs` shows `compliance screening disabled` at boot.
