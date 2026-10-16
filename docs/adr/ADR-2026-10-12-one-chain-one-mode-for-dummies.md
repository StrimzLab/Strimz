# ADR for Dummies: Each Strimz site is either "test" or "live", never both

- **Status:** Accepted (2026-10-12, W1–W4 as recommended)
- **Date:** 2026-10-12

## The Idea

Strimz will run in two places:

- **Live**, on Arc mainnet, where money is real;
- **Sandbox**, on Arc testnet, where merchants try things with play money.

Today the code mixes the two. Merchants could make "test" keys on the live site, and
those would move real money. Shop checkouts are always marked "live", even on the test
site. And the dashboard has a Test/Live switch that only half works.

We make it simple: the site's network decides. The testnet site is always Test, and the
mainnet site is always Live. The switch becomes a label. A key from the wrong world is
refused with a clear message.

We also fix the checkout. If a customer's wallet is set to a different network, we
first ask the wallet to switch to Arc. Only then do we ask for the signature. Today we
can collect a signature for the wrong network, and that payment fails.

## What the Person Sees

- Customers: if their wallet is on the wrong network, they're asked to switch before
  paying.
- Merchants: the dashboard says Test or Live, depending on the site they're on. To
  test, they use the sandbox site with its own keys.
- The maintainer: running the mainnet launch means two sites, live and sandbox. The
  runbook spells out how.

## Important Limitation

Two sites cost two servers and two databases. Old shop sessions on the test site that
were wrongly marked "live" stay that way unless the maintainer runs a one-line fix we
provide.

## Choices for the maintainer

- **W1.** Ask the wallet to switch networks before any signature, and stop with a clear
  error if it can't. Recommended.
- **W2.** One mode per site, enforced by the server and shown as a label. Recommended.
- **W3.** Write down the two-site setup now, and build it with the mainnet launch.
  Recommended.
- **W4.** Leave old mislabelled test-site rows, with an optional fix to run. Recommended.
