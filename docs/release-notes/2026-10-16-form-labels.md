---
date: 2026-10-16
feature: Every remaining form input is labelled (required) * or (optional)
scope: fix
scenario-impact: none
---

# Form label convention gaps

Fixes #152. Trivial under AGENTS.md (labels only, no behaviour change), so no ADR pair.

## What shipped

Every input listed in #152 now uses `FieldLabel`, which renders `(required)` with a red `*`, or `(optional)`:

- **Onboarding:** its `Field` helper uses `FieldLabel`. Required fields had a green `*`, and the optional ones had "(optional)" typed into their label text.
- **Admin broadcasts:** Audience, Merchant, Subject and Message.
- **API keys:** Scopes.
- **Withdraw:** Currency.
- **Webhooks:** Events.
- **New invoice line items:** column headers on wide screens, a label above each input on small screens (where the headers are hidden), and an accessible name on every input.
- **Storefront buy button:** the receipt email is marked optional.
- **Demo merchant:** the custom tip amount is marked `(optional)`. That app doesn't use `@strimz/ui`.

The contact form already used `FieldLabel`.

## Operator steps

None.

## Verification

- **Red, then green:** `form-label-convention.test.ts` failed 13 of 13 on `1587146`.
- **Results:**
  - web: 454 of 454;
  - `./scripts/preflight.sh` in full.
