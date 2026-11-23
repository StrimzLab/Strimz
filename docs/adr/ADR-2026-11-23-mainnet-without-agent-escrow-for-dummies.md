# ADR (plain English): Launch mainnet without the unfinished agent feature

- **Status:** Accepted 2026-11-23 by the founder
- **Date:** 2026-11-23

## What's the problem?

Strimz has an "agent jobs" feature (paying AI agents for work through an escrow). It's switched off and isn't finished:

- **Money can't flow through it yet:** jobs can't be funded or paid out.
- **The audit says not to put it on mainnet until it's fixed.**

But parts of Strimz currently refuse to start unless that feature's contracts exist. So we couldn't launch without putting unfinished code on mainnet.

## What are we doing?

- **We don't put the agent contracts on mainnet.**
- **Strimz starts fine without them.** The parts that needed them now skip them when they aren't there.
- **Nothing can accidentally use the feature.** Trying to create an agent job is refused with a clear message.
- **When it's finished,** we add its contracts to mainnet later, without redeploying anything else.

## What does it change?

- **Merchants see no difference.** The feature was already hidden.
- **Mainnet launches with only the finished, audited contracts.**
