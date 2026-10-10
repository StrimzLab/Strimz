---
date: 2026-10-10
feature: Merchants can no longer choose their fee tier, and an admin tier change follows the on-chain fee
scope: fix
scenario-impact: needs_automation
---

# Merchant tier control: Strimz sets the tier, the Registry sets the fee

A merchant can no longer change its own pricing tier. Every merchant now registers
on-chain at the Free fee (150 bps, which is also its fee ceiling), and an admin tier
change is accepted only when the on-chain `StrimzRegistry` already charges that tier's
fee. Changing the fee on-chain stays an operator action with the cold admin key.

Closes #128. ADR:
[ADR-2026-10-10-merchant-tier-control](../adr/ADR-2026-10-10-merchant-tier-control.md)
([plain-English version](../adr/ADR-2026-10-10-merchant-tier-control-for-dummies.md)).

## What was wrong

- `POST /v1/merchants/me/tier` let any dashboard session set any tier, including
  `business` and `enterprise`, with no billing step, approval or audit entry.
- Before registration, the picked tier's fee was written to the Registry as both the fee
  and the ceiling the merchant consented to. A merchant that picked `business` registered
  at 50 bps, and because the ceiling can only be lowered, Strimz could never raise it
  back to 150 bps.
- After registration, a tier change from either route changed only the database. The
  chain kept charging the registration fee, while the database tier still drove the daily
  relay quota (500 a day on Free, 50,000 on Business and Enterprise) and the fee previews
  on sessions and invoices.

## What shipped

- `POST /v1/merchants/me/tier` is removed and answers `404` like any unknown route.
  `MerchantsService.changeTier` and `ChangeTierDto` are gone. `changeTierInputSchema`,
  `ChangeTierInput` and `ChangeTierParsed` stay in `@strimz/shared-types` for this
  release (no package change, no changeset).
- `registerMerchant` always writes the default tier's fee,
  `effectiveFeeBps(DEFAULT_TIER, 'one_shot')` (150 bps), whatever the row's tier. The
  relay runner no longer reads the tier.
- `PATCH /v1/admin/merchants/:id/tier` reads `getMerchant` from the Registry before it
  writes:
  - not registered on-chain: only `free` is accepted, any other tier is
    `409 merchant_not_registered`;
  - `free`, `growth`, `business`: the tier's fee above the on-chain `maxFeeBps` is
    `409 onchain_fee_above_ceiling`; an on-chain `feeBps` different from the tier's fee is
    `409 onchain_fee_mismatch`. Both carry
    `details: { onchainMerchantId, onchainFeeBps, requiredFeeBps, maxFeeBps }`;
  - `enterprise`: any on-chain fee is accepted;
  - a failed Registry read is `503 chain_unavailable`.

  Nothing is written on any refusal. On success the `merchant.tier_changed` audit entry
  also records `onchainMerchantId` and `onchainFeeBps`.

- The relayer gets no new role. The operator runbook in
  [`packages/contracts/README.md`](../../packages/contracts/README.md#operator-runbook)
  gains the `setFeeBps` step: send it with the cold admin key, wait for the receipt,
  then set the tier in the admin page.
- Dashboard settings show the tier's fee from `@strimz/shared-config` (Free was shown as
  0.5%; it is 1.5%) and say that Strimz sets the tier, instead of promising automatic
  upgrades that never existed. The admin merchant page explains the on-chain step instead
  of "Changes apply to new payments immediately".
- Docs: `authentication.mdx` no longer lists `/v1/merchants/me/tier` or tells merchants to
  change their tier in the dashboard; `dashboard/api-keys.mdx` no longer names the tier
  among the dashboard-only changes.
- New read-only audit script, `apps/api/scripts/audit-merchant-tiers.mjs`
  (`pnpm --filter @strimz/api audit:merchant-tiers`).

## API behaviour change

- `POST /v1/merchants/me/tier` returns `404`. No `@strimz/sdk` release calls it: the SDK
  removed `merchants.changeTier` in 0.8.0.
- Admins can no longer pre-assign a paid tier before registration. Wait for the merchant
  to register, set the fee on-chain, then set the tier.

## Deploy

The API runs on Lightsail and is redeployed by hand. The redeploy is deferred until the
launch fixes are done, so **the self-serve route stays live in production until then**:
any merchant can still pick a tier, and a pick before registration still locks a
discounted fee ceiling on-chain. The web deploys on merge and can go first; no web code
calls `/me/tier`.

Just before the Lightsail redeploy, in this order:

1. Run the audit against production with a read-only database URL and the public RPC.
   It writes nothing and prints a JSON report:

   ```sh
   DATABASE_URL=<read-only production url> \
   ARC_RPC_URL=<public RPC of the production chain> \
   STRIMZ_REGISTRY_ADDRESS=<production registry proxy> \
   pnpm --filter @strimz/api audit:merchant-tiers
   ```

   - `nonFreeTiers`: every merchant whose tier is not `free`, its latest admin
     `merchant.tier_changed` entry, whether that entry set the current tier
     (`explainedByAdmin`), and a `suggestion` (`reset_to_free` when unregistered and
     unexplained, `decide_from_onchain_fee` when registered and unexplained).
   - `registered`: for every registered merchant, `tier`, `tierFeeBps`, on-chain
     `onchainFeeBps` and `maxFeeBps`, the tiers the admin route would accept for that fee,
     and `flags` (`fee_mismatch`, `fee_below_tier`, `ceiling_below_default`).
   - `flaggedCount`: unexplained non-free tiers plus registered merchants with a flag.

   A failed Registry read stops the script with an error; it does not report a partial
   result.

2. Share the report. Per the ADR's D6, the maintainer then:
   - resets every unregistered merchant with a non-free tier and no
     `merchant.tier_changed` audit row to `free` with the one-off SQL below;
   - sets a registered merchant whose on-chain fee matches a tier to that tier (admin
     page, after this redeploy);
   - lists a registered merchant whose on-chain fee is below Free with a ceiling below
     150 bps for a per-merchant decision under #146.

   ```sql
   BEGIN;
   UPDATE "Merchant" AS m
   SET tier = 'free', "updatedAt" = now()
   WHERE m.tier <> 'free'
     AND m."onchainMerchantId" IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM "AuditLog" AS a
       WHERE a.action = 'merchant.tier_changed'
         AND a."targetType" = 'Merchant'
         AND a."targetId" = m.id
     )
   RETURNING m.id, m.email, m.tier;
   COMMIT;
   ```

3. Redeploy the API (`infra/lightsail/deploy.sh`). This pull request adds no migration.

## Scenario impact

`needs_automation`: covered by API e2e and unit tests; `docs/scenarios/` has no scenario
to update. The Arc testnet check in the ADR has not been run: after the redeploy, onboard
a new merchant and confirm `getMerchant` shows `feeBps = maxFeeBps = 150`; confirm
`POST /v1/merchants/me/tier` returns `404`; set `business` in the admin page and get the
`409` with `requiredFeeBps: 50`; send `setFeeBps(id, 50)` (record the transaction hash);
retry and get `200`; pay that merchant and see a 0.5% fee in `PaymentExecuted`; then
`setFeeBps(id, 150)` and set `free` again.
