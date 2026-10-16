# ADR for Dummies: Test our contracts the way Arc actually behaves

- **Status:** Accepted (2026-10-13, F1–F4 as recommended)
- **Date:** 2026-10-13

## The Idea

Our smart contracts are checked by an automated test suite. Today those tests run on a
generic blockchain simulator. Arc behaves differently in ways that matter for money:

- its USDC is both the gas coin and a token;
- it can refuse transfers to or from blocked addresses.

Arc's own documentation warns that testing on the generic simulator "will run your tests
against Ethereum rules while reporting them as passing".

Circle publishes Arc Foundry, a version of our testing tools that follows Arc's rules.
We tried it:

- All our existing tests pass under Arc's rules.
- A new test that copies the real Arc testnet and pays a merchant with Arc's real USDC
  also passes: the merchant is paid, the fee is collected, nothing is left behind.

We switch everything to Arc Foundry:

1. The automated checks and the pre-merge script use Arc Foundry, with Arc's rules on.
2. New tests run against a copy of the real Arc testnet. They check real USDC payments
   and what happens when a blocked address is involved: one failed subscription charge
   must not spoil the others.
3. The local test blockchain we run on laptops becomes Arc's own version.
4. Deploying and publishing contract source switch to Arc Foundry's commands. The
   actual deploy is the next issue (#142).

## What the Person Sees

- Merchants and payers: nothing changes; we just test more like the real network.
- Developers (and the maintainer): install Arc Foundry once. The pre-merge script asks
  for it.

## Important Limitation

The new tests need the public Arc testnet connection. If it is down, the checks fail
until it is back, rather than quietly skipping.

## Choices for the maintainer

- **F1.** Use Arc Foundry, with Arc's rules on, for all contract checks. Recommended.
- **F2.** Run the real-network copy tests in the automated checks and the pre-merge
  script. Recommended.
- **F3.** Use Arc's own local blockchain for laptop testing. Recommended.
- **F4.** Document Arc Foundry's deploy and publish commands now; switch the scripts in
  #142. Recommended.
