# ADR for Dummies: Closing the doors anyone can walk through

- **Status:** Accepted 2026-10-10
- **Date:** 2026-10-10

## The Idea

Some parts of Strimz have to work without a login: the checkout page a payer opens, the
contact form on the website, and a few lookups the checkout needs. Today several of those
open doors can be abused:

- Anyone who has a checkout link can change whose email the payment receipt goes to, even
  after the payment is made. Anyone who knows a payer's wallet address can redirect that
  payer's future receipts and reminders to their own inbox.
- The contact form and one token lookup have no limit, so a script can flood the support
  inbox or burn through the blockchain data allowance Strimz pays for.
- The "how many requests from this person" counters trust a header that, in some server
  setups, the visitor can write themselves.
- The "are you a robot" check on signup only runs in the browser on one page; the login
  page and any script skip it.
- Our help pages say every wallet is checked against sanctions lists. No such check runs.

We close each door, and ask the maintainer to decide how much sanctions checking Strimz
needs for launch.

## What the Person Sees

1. A payer types their email at checkout as today. If someone else already linked that
   checkout to a different wallet, or the payer switches wallets halfway, the page says
   the checkout is linked to another wallet and asks them to reconnect it or get a new
   link.
2. A checkout that is already paid, expired or cancelled can no longer be given a payer.
3. A payer the merchant already knows keeps the email on file; checkout cannot replace it.
4. The contact form shows Cloudflare's small robot check, and a sixth message within an
   hour from the same connection is refused.
5. Signing up or logging in shows Privy's invisible robot check instead of Strimz's own
   widget.
6. Normal payers never meet a limit; the limits sit far above what one checkout uses.

## Important Limitation

- Whoever links an open checkout first wins. Someone holding a payer's checkout link
  could still link it first, and the payer would need a new link. A stronger version,
  where the wallet signs the email, is listed as a later option.
- A payer cannot change their email through checkout once the merchant knows them;
  Strimz support changes it.
- The fixes reach the live site only when the maintainer redeploys the API server, which
  waits until the other launch fixes are done. Until then every door above stays open.
- Two settings live outside our code and need a person: Privy's robot check, and a look
  at the web server (Caddy) in front of the API.

## What Changes

- Checkout: a payer can be linked only while the checkout is open, only once, and never
  by overwriting an email the merchant already has.
- Every public request type gets its own limit per connection.
- The API stops trusting visitor-written address headers; only the server's own proxy
  is believed.
- The contact form gets a robot check that the server verifies, and the server refuses
  to start without its secret key.
- Signup robot checking moves into Privy, which covers every way of logging in.
- Sanctions screening, for the maintainer to choose:
  - **A (recommended for launch):** no outside screening service. The Arc blockchain
    already refuses payments from wallets Circle has blocked, and Strimz tests every
    payment before sending it, so a blocked wallet fails for free. Our help pages are
    corrected to say exactly that.
  - **B:** check payer and merchant wallets with a screening company (a free sanctions
    list service, or a paid risk service) and refuse payments when the check fails or
    the service is down. A few days of work, slower checkouts, and payments stop when
    the service is down.
  - **C:** keep our own list of Circle-blocked wallets and refuse them with a clear
    message before trying. Better error messages, little extra protection.

## What Does Not Change

- The smart contracts.
- The database layout.
- Payments, fees and subscriptions themselves.
- The SDK. One shared type package gets a small addition for the contact form.
