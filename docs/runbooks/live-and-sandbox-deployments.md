# Runbook: live and sandbox deployments

Background: [ADR-2026-10-12-one-chain-one-mode](../adr/ADR-2026-10-12-one-chain-one-mode.md).

Each Strimz deployment runs on one Arc network, and the network decides its mode:

| Deployment | `ARC_ENVIRONMENT` | `NEXT_PUBLIC_ARC_ENVIRONMENT` | Mode | Accepts                        |
| ---------- | ----------------- | ----------------------------- | ---- | ------------------------------ |
| Live       | `mainnet`         | `mainnet`                     | live | `sk_live_` and `pk_live_` keys |
| Sandbox    | `testnet`         | `testnet`                     | test | `sk_test_` and `pk_test_` keys |

The API refuses a key of the other mode with `403 mode_unavailable`. The dashboard shows a
fixed Test or Live label.

## Mainnet launch

Today's testnet deployment becomes the sandbox. The mainnet launch adds a second,
separate deployment. Nothing is shared between the two: they have separate databases,
Redis, signing keys, contracts, webhooks and merchant accounts.

1. **Names.** Pick the hostnames, for example `api.strimz.finance` and `strimz.finance`
   for live, and `sandbox-api.strimz.finance` and `sandbox.strimz.finance` for the
   sandbox.
2. **Backend.** A second Lightsail container (`infra/lightsail/README.md`) with its own
   `.env`:
   - `ARC_ENVIRONMENT=mainnet` and the mainnet RPC, chain id and token addresses (see
     `docs/release-notes/2026-10-11-arc-mainnet-config.md`);
   - the mainnet contract addresses from the mainnet deploy;
   - its own KMS keys (`docs/runbooks/kms-signers.md`, network `mainnet`).
3. **Web.** A second Vercel project, or environment, with
   `NEXT_PUBLIC_ARC_ENVIRONMENT=mainnet`, `NEXT_PUBLIC_API_URL` pointing at the live API,
   the mainnet contract addresses and a `pk_live_` publishable key.
4. **Privy and Turnstile.** Add both web origins to the Privy app and the Turnstile site,
   or use a separate app per deployment.
5. **Merchants.** A merchant signs up on each deployment separately and gets keys from
   each dashboard. Point integrators at the sandbox first.

## Existing testnet rows

Before #140, storefront checkouts on testnet created sessions in `live` mode. The
dashboard (test only) no longer shows them. To move them, and their transactions, to
`test` on the testnet database only:

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
