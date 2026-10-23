# ADR for Dummies: Notice when a merchant's fee on the chain doesn't match their plan

- **Status:** Accepted 2026-10-23
- **Date:** 2026-10-23

## The Idea

Each plan has a fee: Free 0%, Starter 0.5%, Growth 0.4%. The fee actually charged lives in the on-chain registry. Today Strimz never compares the two. If they ever disagree, Strimz either collects too little, or the merchant pays more than their plan says, and nobody notices. We start recording the chain's fee for each merchant and email the team when it doesn't match the plan.

## What the Person Sees

1. **Merchants:** nothing changes.
2. **You (admin):** if a merchant's chain fee and plan disagree for more than 15 minutes, you get an email at the admin alert address. It's the same email you already get for contract alerts. It names the merchant, their plan, the plan's fee, the fee on the chain, and whether Strimz is under-charging or the merchant is over-paying. It links to the transaction that set the chain fee.
3. **One email per problem:** a new email comes only if the fee or plan changes again.

## Important Limitation

- **The 15-minute wait:** when Strimz moves a merchant to a new plan, it changes the chain first and the plan record a few seconds later. The 15 minutes stops that normal gap from looking like a problem. A real problem is reported after about 15 to 20 minutes.
- **Enterprise:** not checked, since its fee is agreed per customer.
- **Existing merchants:** checked after their next fee change, or after the testnet redeploy (#142) registers everyone again.

## What Changes

- **Database:** each merchant record gains the fee and maximum fee the chain holds, plus when and in which transaction they last changed.
- **Indexer:** fills those in from the chain's events.
- **Scheduler:** a new check every 5 minutes compares them with the plan and queues an alert email when they differ.

## What Does Not Change

- **Contracts:** the smart contracts are unchanged.
- **Fees:** what merchants are charged doesn't change.
- **Screens:** no dashboard or admin screen changes.
- **Plan changes:** how plans and fees are changed stays the same.
