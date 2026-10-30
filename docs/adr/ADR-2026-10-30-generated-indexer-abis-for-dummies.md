# ADR for Dummies: Keep the indexer's contract files in step with the contracts automatically

- **Status:** Accepted 2026-10-30
- **Date:** 2026-10-30

## The Idea

The indexer watches the blockchain and records what our contracts do: payments, charges, fee changes and so on. To understand each event, it keeps a description file for each contract.

Those files were copied by hand. They've fallen out of step: some describe events the contracts no longer have, and some are missing new ones. After the redeploy they'd drift further.

## The Fix

- **A script builds the files** straight from the contracts.
- **The automatic checks fail** if the files don't match the contracts, so nobody can forget to update them.
- **One old event stays for now.** The fee-ceiling event from the current testnet contract is kept until the redeploy (#142) retires that contract.

## What People See

- **Payers and merchants:** nothing.
- **Developers:** a clear failure, with the fix, when a contract change needs the files updated.

## Important Limitation

- **The kept event is temporary.** The old fee-ceiling event has to be removed at the redeploy (#142). It's written down as part of that work.

## What Does Not Change

- What the indexer records.
- The contracts.
