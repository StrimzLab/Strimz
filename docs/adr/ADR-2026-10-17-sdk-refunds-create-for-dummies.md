# ADR for Dummies: Making refunds work from the SDK

- **Status:** Accepted (approved by the maintainer, 2026-10-17)
- **Date:** 2026-10-17

## The Idea

When a merchant starts a refund, Strimz sends back two things: the refund itself, and the details
their wallet needs to send the money back (which token, to whom, how much).

Our SDK expected only the refund. When the answer had both parts, it didn't recognise it and threw
an error, even though the refund had been created. So `strimz.refunds.create()` has never worked,
and the docs told people to call the API by hand.

## What Changes

1. The SDK now accepts the two-part answer and gives the merchant both the refund and the wallet
   details.
2. Recording the transaction after signing sends only what the API needs.
3. The API and the SDK use one shared description of that answer, so they can't drift apart again.
4. A new test runs the real SDK against the real API, so a mismatch like this fails the build.
5. The docs drop the "not yet" warnings and show the SDK call.

## Important Limitation

- Merchants whose code was written for the old (broken) shape need a one-line change. That is why
  this is released as a minor version, not a patch.
- The new SDK-against-API test covers refunds only for now.

## What Does Not Change

The API's answer, the dashboard, the database and the contracts stay as they are.
