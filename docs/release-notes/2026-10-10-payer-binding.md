---
date: 2026-10-10
feature: A hosted checkout binds one payer wallet, and the checkout routes never replace a known customer email
scope: fix
scenario-impact: needs_automation
---

# Public endpoint hardening, part 2: payer binding

The public payer routes no longer let anyone holding a session or plan id redirect a
payer's receipts. A payment session binds to the first wallet that attaches while it is
open, and the checkout routes only ever fill a missing customer email, never replace one.

Part 2 of 5 for #133. ADR:
[ADR-2026-10-10-public-endpoint-hardening](../adr/ADR-2026-10-10-public-endpoint-hardening.md)
([plain-English version](../adr/ADR-2026-10-10-public-endpoint-hardening-for-dummies.md)),
decision 1 (D1, D2). Part 1:
[2026-10-10-public-endpoint-hardening](./2026-10-10-public-endpoint-hardening.md).

## What was wrong

- `POST /v1/checkout/sessions/:id/payer` linked any session to any wallet, whatever its
  status: an open session that already had a payer, one the merchant created for its
  own customer, a confirmed one, or an expired one. The receipt cron then mailed the
  attacker's address.
- Both payer routes replaced `Customer.email` for an existing (merchant, wallet) with
  whatever the body said and appended it to `metadata.emailHistory`. Wallet addresses
  are public on-chain, so anyone could redirect a known customer's receipts and refund
  mail.
- The plan route accepted an archived plan.

## What shipped

- `POST /v1/checkout/sessions/:id/payer` binds with one conditional write: the session
  must be `created` or `awaiting_payment`, `expiresAt` must be in the future, and it must
  have no customer or already be bound to this wallet's customer. The customer upsert
  and the bind run in one transaction, so a refused attach leaves no new customer
  behind.
- Both payer routes create a `Customer` when none exists for (merchant, wallet) and set
  the email of an existing one only when it is null. A known email is never replaced, and
  `emailHistory` is not extended by a refused change.
- `POST /v1/checkout/plans/:id/payer` refuses an archived plan.
- The hosted pay and subscription pages show payer-facing copy for the three new codes.
- `apps/web/content/docs/checkout/hosted.mdx` describes the binding and the codes.
- Merchant API customer creation (`POST /v1/customers`) and sessions created with a
  `customer` keep their current behaviour: they use their own upserts, which this part
  does not touch.

## API behaviour change

| Route                                  | New answer                                                              |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `POST /v1/checkout/sessions/:id/payer` | `409 session_not_open` for a session that is not open or is past expiry |
| `POST /v1/checkout/sessions/:id/payer` | `409 payer_already_bound` when the session is bound to another wallet   |
| `POST /v1/checkout/plans/:id/payer`    | `409 plan_not_active` for an archived plan                              |

The same wallet attaching again to an open session is still `201` with the same
`customerId`.

A payer who connects wallet A, types an email, then switches to wallet B on the same
session now gets `409 payer_already_bound`, and the hosted page says "This checkout is
linked to another wallet. Reconnect it, or ask the merchant for a new link." Before this
change the switch silently rebound the session. A payer whose email changed cannot update
it through checkout once the merchant knows them; Strimz support changes it by hand.

## Deploy

The API part ships with the Lightsail redeploy, which the maintainer is deferring until
the launch fixes are done; until then production keeps rebinding sessions and replacing
known emails. No migration, no new env var.

The web part only adds copy for the new `409` codes and can ship on Vercel before or
after the API. Against the old API the hosted pages keep showing the API message.

## Scenario impact

`needs_automation`: covered by API e2e tests (`payer-binding.e2e.test.ts`) and a web unit
test (`checkout-payer.test.ts`); `docs/scenarios/` has no scenario to update. After the
redeploy, on Arc testnet: attach wallet A to a hosted session, switch to wallet B and see
the new copy, then pay with wallet A and confirm the receipt reaches A's email.
