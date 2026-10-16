# ADR for Dummies: Hide agent escrow and cross-chain payments for launch

- **Status:** Accepted (2026-10-15) for agent escrow. Cross-chain payments are left as they are;
  they will come from Whisk, the maintainer's separate cross-chain widget.
- **Date:** 2026-10-15

## The Idea

Two features are half-built:

- **Agent escrow:** the AI agent pays a supplier through a holding contract.
- **Cross-chain payments:** a customer pays from another blockchain.

Neither can finish today:

- **Escrow:** a job is created but never paid into, and nobody is allowed to release it.
- **Cross-chain:** the code exists, but nothing ever starts it.

You decided to hide both for launch and finish them later. Here is what hiding means:

1. **One switch** marks both features "not available". Everything else reads it.
2. **The API refuses them.**
   - Merchants cannot turn them on.
   - Merchants cannot create or approve escrow jobs.
   - Merchants who already turned one on can still save their other settings.
3. **The agent stops running their background jobs.**
4. **The dashboard shows both as "Coming soon",** with no Jobs tab and no "New job" button.
   - The webhook form stops offering escrow events that never fire.
   - The footer stops mentioning escrow.
5. **The docs say "Coming soon"** where they used to describe these features as working.
6. **At the testnet redeploy, the escrow contract is deployed and then paused,** so nobody can use
   it until it is finished.

No code is deleted. Turning a feature back on is the switch plus the fixes.

## What the Person Sees

- **Merchants:** the features they can use, and two "Coming soon" cards.
- **Developers using the SDK:** the job methods still exist but answer "not available". The docs
  say so.
- **The maintainer:** one more step in the redeploy, where the Safe pauses the escrow.

## Choices for the maintainer

- **D1.** One switch in the shared settings. Recommended.
- **D2.** The API refuses turning them on and refuses job changes; reading stays. Recommended.
- **D3.** Deploy the escrow and pause it (recommended), or do not deploy it.
- **D4.** The privacy page lists Circle (cross-chain) as a service we use. Leave it
  (recommended), or remove it until cross-chain ships.
- **D5.** File two follow-up issues now, "finish escrow" and "finish cross-chain".
  Recommended.
