# ADR for Dummies: Put the fixed contracts live on testnet, after a full dress rehearsal

- **Status:** Accepted (2026-10-13, R1–R8 as recommended; the redeploy runs after all logged issues are resolved)
- **Date:** 2026-10-13

## The Idea

Since July we fixed a lot in our smart contracts:

- the security audit's findings;
- how subscriptions catch up after a gap;
- safer ownership changes;
- one-time subscription approvals;
- splitting admin power between a time-delayed controller and a multi-signature wallet.

None of that is live. The testnet still runs the July contracts, and the payment and
subscription contracts can't be patched in place: they have to be deployed again.

The tools we use to deploy and check the contracts have also fallen behind:

- the end-to-end test talks to the contracts in an old format;
- the checker expects the old admin setup;
- trial runs scribble fake entries into our deployment history.

We fix the tools, then deploy:

1. The tools learn the current contracts and the new admin setup. Trial runs stop
   writing history.
2. A dress-rehearsal script runs the whole deployment against a copy of Arc testnet on
   a laptop: deploy, check, test payments and subscriptions, hand admin to the
   multi-signature wallet, check again. It spends no real money.
3. A step-by-step runbook covers the real deploy:
   - switching off the old contracts;
   - pointing our servers and website at the new ones;
   - tidying testnet data that pointed at the old contracts.

   Merchants re-register automatically, and old test subscriptions are cancelled.

4. After you run it, a small follow-up records the new addresses.

## What the Person Sees

- Merchants and payers on testnet: a short switch-over. Old test subscriptions are
  cancelled and need re-subscribing; everything else carries on.
- The maintainer:
  - prepares the AWS signing keys, the multi-signature wallet and a funded deployer
    key;
  - runs the rehearsal, then the real deploy from the runbook;
  - then redeploys the server.

## Important Limitation

We can't publish the contract source on the explorer during the rehearsal; that only
happens on the real deploy. Mainnet comes later, with the same tools and runbook.

## Choices for the maintainer

- **R1.** Only real deploys write to the deployment history. Recommended.
- **R2.** Two checks: right after deploying, and after the admin handover. Recommended.
- **R3.** Update the end-to-end test to the current contracts. Recommended.
- **R4.** Keep our proven way of publishing contract source. Recommended.
- **R5.** A dress rehearsal on a copy of testnet, required before the real deploy.
  Recommended.
- **R6.** A runbook that covers switching off the old contracts. Recommended.
- **R7.** Tidy only the testnet data that pointed at the old contracts. Recommended.
- **R8.** Record the new addresses in a small follow-up after your deploy. Recommended.
