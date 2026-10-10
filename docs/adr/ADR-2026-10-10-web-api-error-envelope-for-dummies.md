# ADR for Dummies: Error messages that say what went wrong

- **Status:** Accepted 2026-10-10 (E1–E3 as recommended)
- **Date:** 2026-10-10

## The Idea

When the Strimz server refuses something, it sends back a clear reason, a short code and
a reference number. The dashboard and the admin pages open that reply in the wrong place,
so every error pop-up says only "Strimz API error 409" or similar. Nobody can tell what
went wrong, and support cannot find the matching server log.

We fix how the website reads the server's reply, so the real reason and the reference
number reach the screen.

## What the Person Sees

1. A merchant whose action is refused sees the server's reason in the error pop-up, for
   example why a webhook URL was not accepted, instead of a status number.
2. The pop-up ends with a reference such as `(ref req_123)` to quote to support.
3. On the admin page for a merchant, a refused tier change stays on screen under the tier
   picker. It lists the fee the on-chain registry charges, the fee the chosen tier needs,
   the merchant's on-chain id and the highest fee allowed, so the admin knows exactly
   which on-chain change to make first.

## Important Limitation

This changes only what the website shows. The server's decisions stay the same: anything
refused before is still refused.

## Choices for the maintainer

- **E1.** If the server's reply cannot be read at all, show "request failed with status
  N" (recommended), or treat it as a separate kind of error.
- **E2.** Show the reference number in the pop-up (recommended), or leave it out.
- **E3.** Keep a refused tier change on the page with the on-chain numbers (recommended),
  or only show the pop-up.

## Impact

- Website only. No server, database, contract or published package changes.
- Goes live when merged; nothing to do on Lightsail.
