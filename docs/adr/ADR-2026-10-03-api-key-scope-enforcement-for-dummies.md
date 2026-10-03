# ADR for Dummies: Make API keys only do what they were allowed to do

- **Status:** Accepted 2026-10-03
- **Date:** 2026-10-03

## The Idea

A merchant's server talks to Strimz with an API key. When the merchant creates a key,
they tick boxes saying what it may do, for example "create payments" but not "issue
refunds". Strimz checks those boxes on the payment, refund and webhook features, but
not on about two dozen others. On those, any key can do anything, including changing
where the merchant gets paid. We make every feature check the boxes, keep the most
sensitive settings for the dashboard only, and stop a key from creating a stronger key
than itself.

## What the Person Sees

1. A merchant creates a key for their checkout server that can only create payments.
2. Today, if that key leaks, whoever holds it can change the merchant's payout wallet,
   switch their pricing plan, read their customer list, or create a new key with every
   permission.
3. After this change, that key gets "permission denied" on all of those. It can still
   create payments, which is all it was meant to do.
4. The merchant, logged into the dashboard, can still do everything, as today.
5. A merchant who tries to create a live (real money) key before finishing setup
   (email verified, two-factor on, business form done, payout wallet set) is told
   exactly which step is missing, and no key is created.

## Important Limitation

- Existing keys that were given only some permissions will lose access to the features
  they were never meant to reach. Keys that were given every permission keep working.
  Merchants with narrower keys may need to tick the new boxes.
- Two SDK functions, "update merchant profile" and "change plan", will stop working
  with an API key. Those become dashboard-only.
- A live key that was created while the merchant was eligible keeps working if the
  merchant later turns off two-factor. The check happens when a key is created, not on
  every call.

## What Changes

- Every merchant feature reachable with an API key now requires a matching permission.
  Features nobody labelled are closed to keys by default.
- Changing the payout wallet, the pricing plan, finishing onboarding, and the
  notification bell are dashboard-only.
- Four new permissions: read merchant profile, read customers, write customers, read
  analytics. The storefront permissions that already appeared in the list now actually
  do something.
- A key can only create keys with permissions it already has, and only in its own mode
  (test or live). A test key can no longer touch live keys.
- Creating a live key checks that the merchant has finished setup.
- The public documentation is corrected; it already promised most of this.

## What Does Not Change

- The dashboard: merchants logged in see and can do exactly what they can today.
- Payments, subscriptions, refunds, invoices, webhooks, agents and the relay: these
  already checked permissions and keep doing so.
- The smart contracts, the indexer, webhooks sent to merchants, and the checkout pages.

## Decisions We Need From You

1. Close unlabelled features to keys by default? We recommend yes.
2. Make payout wallet, pricing plan, onboarding and notifications dashboard-only? We
   recommend yes.
3. Accept that two SDK functions stop working with keys? We recommend yes, with a
   deprecation notice.
4. Names of the four new permissions. We recommend `merchants_read`,
   `customers_read`, `customers_write`, `analytics_read`.
5. Which existing keys get the new permissions automatically? We recommend only keys
   that already have every permission.
6. Stop keys from creating stronger keys or keys in the other mode? We recommend yes.
7. Keep live keys closed on the server until Arc mainnet is ready, matching the greyed
   out option in the dashboard? We recommend yes.
