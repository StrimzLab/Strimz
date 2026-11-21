import { Prisma } from '../generated/prisma/client.js'

export interface PooledVolumeRow {
  id: string
  email: string
  businessName: string | null
  onchainMerchantId: number
  tier: string
  currency: 'USDC' | 'EURC'
  /** Confirmed, non-refund volume of this merchant and every account linked to it. */
  volume: string
  ownVolume: string
  /** Merchant ids whose payments count toward `volume`, this one included. */
  contributors: string[]
}

interface QueryRaw {
  $queryRaw<T>(query: Prisma.Sql): Promise<T>
}

/**
 * Accounts that share a payout address or an owner wallet share one free allowance
 * (ADR-2026-11-21-free-plan-fee-integrity). Links are direct, not transitive.
 */
export function pooledVolumes(
  db: QueryRaw,
  opts: { mode: 'test' | 'live'; merchantId?: string },
): Promise<PooledVolumeRow[]> {
  const onlyMerchant = opts.merchantId ? Prisma.sql`AND m.id = ${opts.merchantId}` : Prisma.empty
  return db.$queryRaw<PooledVolumeRow[]>(Prisma.sql`
    SELECT m.id,
           m.email,
           m."businessName",
           m."onchainMerchantId",
           m.tier::text AS tier,
           t.currency::text AS currency,
           sum(t.amount::numeric)::text AS volume,
           coalesce(sum(t.amount::numeric) FILTER (WHERE t."merchantId" = m.id), 0)::text AS "ownVolume",
           array_agg(DISTINCT t."merchantId") AS contributors
      FROM "Merchant" m
      JOIN "Merchant" linked
        ON linked.id = m.id
        OR (linked."onchainMerchantId" IS NOT NULL AND (
             (m."payoutAddress" IS NOT NULL AND lower(linked."payoutAddress") = lower(m."payoutAddress"))
          OR (m."walletAddress" IS NOT NULL AND lower(linked."walletAddress") = lower(m."walletAddress"))))
      JOIN "Transaction" t ON t."merchantId" = linked.id
     WHERE m."onchainMerchantId" IS NOT NULL
       AND m.tier <> 'enterprise'::"MerchantTier"
       AND t.status = 'confirmed'::"TransactionStatus"
       AND t.kind <> 'refund'::"TransactionKind"
       AND t.mode = ${opts.mode}::"Mode"
       ${onlyMerchant}
     GROUP BY m.id, t.currency
     ORDER BY m.id`)
}
