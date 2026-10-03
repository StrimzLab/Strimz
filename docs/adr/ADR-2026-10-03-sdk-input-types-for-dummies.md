# ADR for Dummies: Let developers leave out the settings Strimz already fills in

- **Status:** Accepted 2026-10-03
- **Date:** 2026-10-03

## The Idea

When a developer creates a payment session, Strimz gives it 30 minutes to be paid
unless the developer asks for something else. The Strimz code library for developers
(the SDK) does not know that. It refuses to build the request until the developer types
the 30 themselves. Eight other request types have the same problem. We fix the library's
type descriptions so that anything Strimz fills in by itself is marked optional, and we
give our own server code a separate name for the filled-in version.

## What the Person Sees

1. A developer installs `@strimz/sdk` and writes
   `paymentSessions.create({ amount: '1000000', currency: 'USDC' })`.
2. Today their editor shows a red error: "expiresInMinutes is missing". The request
   would work if sent, but the code will not build.
3. After this change the same line builds, and the session expires after 30 minutes, as
   the documentation says.
4. The same applies to the plan interval count, the subscription grace period, the
   invoice due date, storefront social links, product sort order, and the agent
   settings. Changing one agent setting no longer requires typing all of its neighbours.

## Important Limitation

- This changes descriptions only. It does not change what the server accepts or what it
  does with a request.
- Changing one agent setting through the API still resets the other settings in the same
  group to their defaults on the server. That is a separate bug found during this work
  and needs its own fix.
- The SDK's "create subscription" call points at an address the server does not have.
  That is also separate.
- Whether to delete the unused "allowed source chains" option on payment sessions is not
  decided here. It depends on whether cross-chain funding is in the launch (issue #145).

## What Changes

- Nine request types in `@strimz/shared-types` stop requiring fields that have a default.
- Every request type gets a twin ending in `Parsed` that describes the request after
  Strimz has filled in the defaults. Our API uses the twin.
- The SDK's methods accept the shorter requests.
- A new automated check fails the build if any of this drifts again.
- New versions: `@strimz/shared-types` and `@strimz/sdk` go from 0.5.0 to 0.6.0.
  Developers on 0.5.x are not upgraded automatically.

## What Does Not Change

- Anything sent over the network, any API address, the database, webhooks and the
  dashboard.
- Code that already passes the defaulted values keeps working.
- Payment, subscription and refund behaviour on the blockchain.
