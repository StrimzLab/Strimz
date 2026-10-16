# ADR for Dummies: Merchants stop picking their own price plan

- **Status:** Accepted 2026-10-10
- **Date:** 2026-10-10

## The Idea

Every merchant is on a price plan ("tier"): Free, Growth, Business or Enterprise. The
plan decides the fee Strimz takes on each payment and how many transactions Strimz will
pay network fees for each day. Today a merchant can switch itself to the cheapest plan
with one request, without paying anything, because there is no billing for plans at all.
If it does that before its account is written to the blockchain, the cheap fee is
written there for good, and Strimz cannot raise it again. If it does it later, Strimz's
database and the blockchain disagree. We take the switch away from merchants, make every
new account start on the Free fee, and only let Strimz staff change a plan once the
blockchain already charges that plan's fee.

## What the Person Sees

1. A merchant sees its plan in Settings, with the real fee for that plan. The page no
   longer says plans upgrade automatically (they never did) or that Free costs 0.5% (it
   costs 1.5%).
2. A merchant who asks Strimz for a different plan gets it from Strimz staff, not from a
   button.
3. A staff member who changes a merchant's plan in the admin page is told, if the
   blockchain still charges the old fee, exactly which fee to set on the blockchain
   first. After that is done, the change goes through.
4. A staff member cannot give a paid plan to a merchant who is not on the blockchain yet.

## Important Limitation

- Changing a fee on the blockchain stays a manual step with Strimz's offline admin key.
  It is slower than a button, which is fine while nobody pays for plans.
- A merchant can still lower its own fee directly on the blockchain, from its own
  wallet, down to zero. That is part of how the contract was built and is being decided
  separately (issue #146). This change does not fix it; the check below will spot it.
- Until the API server is redeployed, the old switch keeps working in production. We will
  check the data right before the redeploy.

## What Changes

- The "change my plan" request for merchants is removed.
- Every merchant written to the blockchain from now on starts at the Free fee (1.5%),
  which is the highest standard fee, so Strimz can later move the merchant to any plan
  and back.
- A staff plan change checks the blockchain first and refuses if the fees do not match.
- A one-off read-only check before release lists every merchant whose plan looks
  self-chosen, or whose blockchain fee does not match its plan. The maintainer decides
  what to do with each.
- Settings, admin page and help pages are corrected.

## What Does Not Change

- The smart contracts.
- The fee on payments already made.
- The SDK and other published packages.
- The current three test merchants on the blockchain: all three already pay the Free fee.
