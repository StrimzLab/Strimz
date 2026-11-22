# ADR (plain English): Give each part of Strimz the free RPC it can use

- **Status:** Accepted 2026-11-22 by the founder
- **Date:** 2026-11-22

## What's the problem?

An RPC is how Strimz talks to the Arc blockchain. Strimz has three parts that do:

- **the API**, which sends customer payments;
- **the scheduler**, which charges subscriptions and sends refunds;
- **the indexer**, which reads what happened on chain.

Today all three must use the same RPC, and we can't pay for one. The free ones each have a catch:

- **Arc's own public RPC** can read large stretches of the chain, which the indexer needs. But it's shared with everyone.
- **Alchemy and QuickNode free** are steadier, but they only read 5–10 blocks at a time. That's too few for the indexer.

## What are we doing?

- **The indexer gets its own setting,** pointed at Arc's public RPC.
- **The API and scheduler use Alchemy first.** If it fails, they try QuickNode, then Arc's public RPC, so one provider going down doesn't stop payments.
- **Strimz checks every RPC when it starts.** A wrong network, or one that can't read enough blocks for the indexer, stops it from starting with a clear message, instead of failing later.
- **Keys inside RPC addresses never show up in logs.**

## What does it change?

- **It costs nothing.**
- **Payments and charges keep working if one RPC provider has a bad day.**
- **If Arc's public RPC goes down,** the indexer pauses and catches up when it's back. Payments still go through.
