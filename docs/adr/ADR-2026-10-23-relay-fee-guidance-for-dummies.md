# ADR for Dummies: Stop overpaying for relayed payments, and make retries work

- **Status:** Accepted 2026-10-23
- **Date:** 2026-10-23

## The Idea

When Strimz sends a payment to the chain for a customer, it adds a 1 gwei "tip" for the block producer. Arc says the tip should be 0 almost all the time. Our real testnet payments show the tip is about 5% of every fee. We drop it to 0 and add a tip only when a payment has to be retried.

While checking this we found a real problem. When a payment is stuck and Strimz retries it, the retry is priced too close to the original. The network refuses it, so the retry can't push the payment through. We fix that too.

## What the Person Sees

1. Nothing changes on any screen.
2. Each relayed payment costs Strimz about 5% less in network fees. A typical payment drops from about $0.0039 to $0.0037.
3. If the network is busy and a payment gets stuck, the retry now goes through instead of failing.

## Important Limitation

- **Busy network:** when the network is very busy, a first attempt with no tip may wait a little longer. If it hasn't landed within a minute, the retry adds the tip Arc recommends.
- **Test after deploy:** I can't send a testnet payment from here. After deploy, you relay one payment, and we check its fee and how fast it lands.

## What Changes

- **First try:** no tip.
- **Retries:** use the tip Arc's network recommends at that moment.
- **Fee source:** the fee is read from the value Arc publishes for the next block, as Arc's docs advise.
- **Stuck payments:** Strimz remembers the fees it used for each payment it sends. A retry of a stuck payment is priced at least 12.5% higher, enough for the network to accept it.

## What Does Not Change

- **Spare margin:** the safety margin on the maximum fee stays at 2×. It doesn't change what we pay, only how much balance the relayer must hold.
- **Everything else:** contracts, the database, webhooks, the SDKs and every page stay as they are.
