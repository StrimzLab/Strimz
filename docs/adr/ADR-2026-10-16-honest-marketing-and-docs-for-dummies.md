# ADR for Dummies: The website and docs say only what's true

- **Status:** Accepted (approved by the maintainer, 2026-10-16)
- **Date:** 2026-10-16

## The Idea

Our website shows numbers we never earned ($48M settled, 99.97% uptime), logos of
companies that don't exist, and features we haven't built (paying from other chains,
wallet screening, identity checks). Our docs describe how subscriptions, retries and
cancels work, and much of that is wrong. A business owner who checks any of it stops
trusting us. We fix every false line.

## What the Person Sees

1. The homepage, Customers and About no longer show made-up numbers or logos. Real
   numbers come back later, from the new "honest proof" section (#277).
2. The three customer quotes stay, rewritten to sound like real people talking about
   what Strimz really does. You supply the real names, and the people quoted approve them.
3. Features we haven't built are called "coming", or are not mentioned.
4. Pricing explains the real rule: free for your first $1,000, then 0.5%, then 0.4% from
   $50,000.
5. The developer docs match how the product actually behaves.

## Important Limitation

- While we checked the docs we found six real bugs in the product (#291–#296). One example:
  our SDK can create a payment twice if the server hiccups. These are fixed separately.
  Until then the docs say "not yet" and link the bug.
- Some things only you know: which email inboxes exist, our social handles, and where the
  team is based. We'll ask rather than guess.

## What Changes

- Marketing pages, legal pages, developer docs and package READMEs.
- One small code change: the pricing table reads its thresholds from the real plan list,
  so it can't drift again.

## What Does Not Change

- The product itself: payments, subscriptions, the API and the contracts.
- Prices.
