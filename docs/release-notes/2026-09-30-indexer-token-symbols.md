---
date: 2026-09-30
feature: EURC payments are recorded as EURC
scope: fix
scenario-impact: needs_automation
---

# The indexer maps token addresses to symbols from configuration

Payments and subscriptions in EURC are recorded with the right currency. Before, the
indexer labelled every configured stablecoin, and every unknown token, as USDC.

Closes #117.

## Configuration change, action required before deploy

`STABLECOIN_ADDRESSES` now takes `SYMBOL:address` entries, comma separated, and must
list at least one. Only `USDC` and `EURC` are accepted. Example for Arc testnet:

```
STABLECOIN_ADDRESSES=USDC:0x3600000000000000000000000000000000000000,EURC:0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a
```

A bare address, an unknown symbol, a duplicate, or an empty list stops the indexer at
boot with a message naming the entry. `infra/lightsail/env.example` and
`apps/indexer/.env.example` carry the new format.

## What shipped

- Configuration validation parses the symbol map. The runner and projector use it;
  nothing assumes USDC any more.
- A `PaymentExecuted` or `SubscriptionCreated` event for a token that is not configured
  fails the batch with an error naming the token address. The indexer does not advance
  past it until the token is added to the configuration. Nothing is recorded under the
  wrong currency.

## Found while here

`infra/lightsail/env.example` set this variable to `${ARC_USDC_ADDRESS}`. Docker's
`--env-file` does not expand variables, so a deployment that copied the example without
editing that line has been passing the literal text to the indexer, which the existing
validation rejects at boot. Check the indexer process on the Lightsail box.
