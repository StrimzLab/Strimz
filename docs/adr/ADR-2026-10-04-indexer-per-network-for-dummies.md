# ADR for Dummies: Make the indexer check which blockchain it is reading, and record every change the contracts announce

- **Status:** Accepted 2026-10-04
- **Date:** 2026-10-04

## The Idea

The indexer is the part of Strimz that reads the blockchain and updates our database.
Today it never asks the blockchain provider which network it is talking to, and its
bookmarks ("I have read up to block N") do not say which network they belong to. We make
it confirm the network at start-up and refuse to run on the wrong one, label every
bookmark with its network, and start recording the ownership, payout and admin changes
the contracts announce but the indexer currently ignores.

## What the Person Sees

1. An operator deploys the indexer for Arc testnet with a settings file that names the
   network id, the starting block and how many blocks to wait.
2. If any of those settings is missing, the indexer stops at start-up and says which one.
3. If one of the blockchain providers in the file is actually on another network, the
   indexer stops at start-up and names the provider and both network ids.
4. Once running, it picks up exactly where it left off. Nothing is read twice or skipped.
5. When a merchant starts handing their account to a new wallet, or starts changing where
   their money is paid, the indexer writes a record of it and a warning line in its logs,
   so the operations team can check the change was expected.
6. When an admin pauses a contract, withdraws platform fees or enables a new token, the
   indexer writes a record of that too.

## Important Limitation

- The new records are kept in the database and the logs. They do not appear on the
  merchant dashboard, and no email or webhook is sent. The dashboard already shows a
  pending ownership or payout change by reading the blockchain directly.
- Testnet and mainnet still need separate databases. This change stops the bookmarks from
  colliding, not the payment and merchant records.
- Contract role changes and upgrades are not covered here; they need alerts to a person,
  which is a separate piece of work.

## What Changes

- Four more settings per network (network id, starting block, blocks to wait, token
  whitelist address). None of them has a hidden default any more.
- A start-up check that every blockchain provider is on the configured network.
- Bookmarks and the holding table for unprocessable events are labelled with the network.
  One database update relabels what exists today; the running testnet keeps its place.
- Thirteen contract announcements that were ignored are now recorded: six about merchant
  ownership, payout and fee limits, and seven about pausing, fee withdrawals, contract
  wiring and the token whitelist.
- One old announcement that the current contract can no longer make stops being
  recorded.
- Replaying a stretch of the blockchain does not create duplicate records of these
  announcements.

## What Does Not Change

- The smart contracts, the API, the dashboard, webhooks and the SDK.
- How payments, subscriptions, refunds and agent jobs are recorded.
- The merchant's sign-in wallet on file. An ownership transfer is recorded, but the
  account's wallet stays the one the merchant signs in with.
