# ADR for Dummies: Get an email when someone changes who controls the contracts

- **Status:** Accepted (2026-10-16, D1 to D6 as recommended)
- **Date:** 2026-10-16

## The Idea

Our smart contracts have "roles": who can pause them, who can upgrade them, who can change
fees. If an attacker stole an admin key, the first thing they would do is give themselves a
role or swap in new contract code. Today nothing writes that down, and nobody would know.

We make the indexer, the service that reads the blockchain for us, watch for it:

1. **It watches every Strimz contract,** including two it ignores today: the agent identity
   registry and the timelock, the delay contract the Safe uses for big changes.
2. **It records** every role change, contract upgrade, timelock action and pause in the audit
   log.
3. **The scheduler emails you** at the ops alert address within about a minute. All events
   found in one minute go into one email, so a big planned change sends one email, not
   seventy.
4. **Agent identity changes** are written down but do not email.

Every email links to the transaction on Arcscan, so you can check whether it was you.

## What the Person Sees

- **You (the operator):** an email whenever someone grants or removes a role, upgrades a
  contract, uses the timelock, or pauses something. Planned changes email too, as
  confirmation.
- **Merchants:** nothing changes.

## Important Limitation

- **Email only.** If nobody reads the alert inbox, the alert is just a database row. Choice
  D2 adds a chat webhook.
- **Not watched:** the Safe's own settings (who the signers are) and the old July contracts.

## Choices for the maintainer

- **D1.** Email on roles, upgrades, timelock and pauses; only record agent identity changes.
  Recommended.
- **D2.** Email only (recommended), or also post to Slack or Discord.
- **D3.** Email every event (recommended), or label each one expected or unexpected.
- **D4.** Agent identity changes: record only (recommended), or also update our agent table.
- **D5.** No admin page for this now; file a follow-up. Recommended.
- **D6.** Leave the Safe's own settings to the Safe app (recommended), or watch them too.
