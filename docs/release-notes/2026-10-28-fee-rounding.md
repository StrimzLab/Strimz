---
date: 2026-10-28
feature: Fees round down by decision, locked by tests, with one fee function in the API
scope: chore
scenario-impact: none
---

# Fees: rounding down is the rule, and the API uses the contracts' formula

Strimz fees are `amount × feeBps / 10,000`, rounded down. That stays. We decided on #382, out of three options, to keep it this way. With rounding down, Strimz never takes more than a merchant's rate or the maximum fee they agreed to on chain. Rounding up could exceed that maximum by one base unit.

Refs #382 (epic #387). No ADR: no behaviour changes and no contract changes. The maintainer chose this option on the issue.

## What it means in practice

- The current rates are 0%, 0.5% and 0.4%. Rounding down undercharges by less than one base unit (0.000001 USDC) per payment.
- A payment pays no fee only when it's below `10,000 / feeBps` base units, which is 0.0002 USDC at 0.5%. The API refuses payments under 1.00, so every payment it creates carries its full fee. Only a direct contract call can make one that small, and its gas costs far more than the fee it avoids.
- Fees aren't part of matching a payment to its checkout. The indexer stores the fee from the on-chain event, so the API's preview can never block a confirmation.

## What shipped

- **Contract tests:** `packages/contracts/test/FeeRounding.t.sol`. For any amount up to 1e15 and any rate up to the merchant's maximum (at most 5%), it fuzzes `pay` and a subscription charge and checks:
  - the fee is exactly `amount × feeBps / 10,000`, rounded down;
  - it's never more than `amount × maxFeeBps / 10,000`;
  - fee plus net equals the amount.

  Two fixed cases: 199 base units at 0.5% pays no fee, and 1.00 at 0.5% pays 5,000.

- **API:** `apps/api/src/common/money/fee-split.ts` holds the contracts' rule in one function, `feeSplit(amount, feeBps)`. It throws on a rate outside 0–500 or that isn't a whole number. Payment sessions and invoices both use it now, where before each did the maths separately. The results are the same.
- **API test:** `apps/api/test/unit/common/fee-split.test.ts` checks fixed values against the contract formula, that the fee never exceeds the rate, and that bad rates are rejected.

## Verification

- The new contract tests pass, at 256 fuzz runs each, as do all existing suites.
- The `feeSplit` test failed first because the module didn't exist, then passed with 11 tests.
- The plan-fee, invoice and payment-session e2e tests pass.
- `./scripts/preflight.sh` passed in full: 252 contract tests, 6 fork tests and 289 API unit tests.
