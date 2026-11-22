# Runbook: the live deployment

Background: [ADR-2026-11-22-live-only](../adr/ADR-2026-11-22-live-only.md). It supersedes the sandbox plan in [ADR-2026-10-12-one-chain-one-mode](../adr/ADR-2026-10-12-one-chain-one-mode.md).

Strimz launches with one deployment, on Arc mainnet, in live mode. There is no sandbox deployment, no test mode and no test keys for merchants.

| Deployment | `ARC_ENVIRONMENT` | `NEXT_PUBLIC_ARC_ENVIRONMENT` | Mode | Accepts                        |
| ---------- | ----------------- | ----------------------------- | ---- | ------------------------------ |
| Live       | `mainnet`         | `mainnet`                     | live | `sk_live_` and `pk_live_` keys |

The API refuses any other key with `403 mode_unavailable`.

## Until mainnet

Today's Arc testnet deployment is Strimz's own development environment. It runs in test mode with `sk_test_` keys. It's not offered to merchants, and it's retired or kept for internal use once mainnet is live.

## Mainnet launch

1. **Backend.** The `strimz` container on the OVH server, with its `.env` switched to mainnet:
   - `ARC_ENVIRONMENT=mainnet`, plus the mainnet RPC, chain id and token addresses (see `docs/release-notes/2026-10-11-arc-mainnet-config.md`);
   - the mainnet contract addresses from the mainnet deploy;
   - mainnet signing keys (#455).
2. **Web.** The Cloudflare Workers (`strimz-web`, `strimz-dashboard`, `strimz-checkout`, `strimz-admin`, `strimz-docs`) built with:
   - `NEXT_PUBLIC_ARC_ENVIRONMENT=mainnet`;
   - the mainnet contract addresses;
   - a `pk_live_` publishable key where one is used.
3. **Privy and Turnstile.** Keep the existing apps. The domains don't change.
4. **Merchants** sign up once and get live keys after onboarding. To try their integration, they make a small real payment. See the docs page "Testing your integration".

## Existing testnet rows

Before #140, storefront checkouts on testnet created sessions in `live` mode. To move them, and their transactions, to `test` on the testnet database only:

```sql
SELECT count(*) FROM "PaymentSession" WHERE mode = 'live' AND "storefrontProductId" IS NOT NULL;

BEGIN;
UPDATE "Transaction" SET mode = 'test'
  WHERE mode = 'live'
    AND "sessionId" IN (
      SELECT id FROM "PaymentSession" WHERE mode = 'live' AND "storefrontProductId" IS NOT NULL
    );
UPDATE "PaymentSession" SET mode = 'test'
  WHERE mode = 'live' AND "storefrontProductId" IS NOT NULL;
COMMIT;
```

Never run this against the mainnet database.
