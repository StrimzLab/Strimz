#!/usr/bin/env node
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, isAddress, parseAbi } from 'viem'
import { DEFAULT_TIER, TIERS, effectiveFeeBps } from '@strimz/shared-config'
import { print } from './print.mjs'

const STANDARD_TIERS = Object.keys(TIERS).filter(
  (tier) => effectiveFeeBps(tier, 'one_shot') !== null,
)
const CUSTOM_TIERS = Object.keys(TIERS).filter((tier) => effectiveFeeBps(tier, 'one_shot') === null)

const registryAbi = parseAbi([
  'function getMerchant(uint256 merchantId) view returns ((address owner, uint16 feeBps, bool active, address payoutAddress, uint256 parentMerchantId, address pendingOwner, address pendingPayoutAddress, uint64 payoutChangeCommitAt, uint16 maxFeeBps))',
])

function defaultFeeBps() {
  const feeBps = effectiveFeeBps(DEFAULT_TIER, 'one_shot')
  if (feeBps === null) throw new Error(`default tier ${DEFAULT_TIER} has no fixed one-shot fee`)
  return feeBps
}

function latestTierChanges(tierChanges) {
  const latest = new Map()
  for (const change of tierChanges) {
    const current = latest.get(change.targetId)
    if (!current || new Date(change.createdAt) > new Date(current.createdAt)) {
      latest.set(change.targetId, change)
    }
  }
  return latest
}

function nonFreeRow(merchant, lastChange) {
  const next = lastChange?.metadata?.next ?? null
  const explainedByAdmin = next === merchant.tier
  let suggestion = 'none'
  if (!explainedByAdmin) {
    suggestion = merchant.onchainMerchantId === null ? 'reset_to_free' : 'decide_from_onchain_fee'
  }
  return {
    merchantId: merchant.id,
    email: merchant.email,
    tier: merchant.tier,
    onchainMerchantId:
      merchant.onchainMerchantId === null ? null : String(merchant.onchainMerchantId),
    lastAdminTierChange: lastChange
      ? {
          actorId: lastChange.actorId,
          at: new Date(lastChange.createdAt).toISOString(),
          previous: lastChange.metadata?.previous ?? null,
          next,
        }
      : null,
    explainedByAdmin,
    suggestion,
  }
}

function registeredRow(merchant, record) {
  const tierFeeBps = effectiveFeeBps(merchant.tier, 'one_shot')
  const flags = []
  if (tierFeeBps !== null && record.feeBps !== tierFeeBps) flags.push('fee_mismatch')
  if (tierFeeBps !== null && record.feeBps < tierFeeBps) flags.push('fee_below_tier')
  if (record.maxFeeBps < defaultFeeBps()) flags.push('ceiling_below_default')
  const accepted = STANDARD_TIERS.filter(
    (tier) => effectiveFeeBps(tier, 'one_shot') === record.feeBps,
  )
  return {
    merchantId: merchant.id,
    onchainMerchantId: String(merchant.onchainMerchantId),
    tier: merchant.tier,
    tierFeeBps,
    onchainFeeBps: record.feeBps,
    maxFeeBps: record.maxFeeBps,
    tiersAcceptedByAdminRoute: [...accepted, ...CUSTOM_TIERS],
    flags,
  }
}

export function auditMerchantTiers({ merchants, tierChanges, registry }) {
  const latest = latestTierChanges(tierChanges)
  const nonFreeTiers = merchants
    .filter((merchant) => merchant.tier !== DEFAULT_TIER)
    .map((merchant) => nonFreeRow(merchant, latest.get(merchant.id)))

  const registered = merchants
    .filter((merchant) => merchant.onchainMerchantId !== null)
    .map((merchant) => {
      const record = registry.get(String(merchant.onchainMerchantId))
      if (!record) {
        throw new Error(
          `no registry record read for merchant ${merchant.id} (on-chain id ${merchant.onchainMerchantId})`,
        )
      }
      return registeredRow(merchant, record)
    })

  const flaggedCount =
    nonFreeTiers.filter((row) => !row.explainedByAdmin).length +
    registered.filter((row) => row.flags.length > 0).length

  return { nonFreeTiers, registered, flaggedCount }
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`${name} is not set.`)
    process.exit(2)
  }
  return value
}

async function main() {
  const databaseUrl = requireEnv('DATABASE_URL')
  const rpcUrl = requireEnv('ARC_RPC_URL')
  const registryAddress = requireEnv('STRIMZ_REGISTRY_ADDRESS')
  if (!isAddress(registryAddress)) {
    console.error(`STRIMZ_REGISTRY_ADDRESS is not an address: ${registryAddress}`)
    process.exit(2)
  }

  const { createPrismaClient } = await import('@strimz/db')
  const prisma = createPrismaClient({ databaseUrl })
  const client = createPublicClient({ transport: http(rpcUrl) })

  try {
    const merchants = await prisma.merchant.findMany({
      where: { OR: [{ tier: { not: DEFAULT_TIER } }, { onchainMerchantId: { not: null } }] },
      select: { id: true, email: true, tier: true, onchainMerchantId: true },
      orderBy: { createdAt: 'asc' },
    })
    const tierChanges = await prisma.auditLog.findMany({
      where: { action: 'merchant.tier_changed', targetType: 'Merchant' },
      select: { targetId: true, actorId: true, createdAt: true, metadata: true },
    })

    const registry = new Map()
    for (const merchant of merchants) {
      if (merchant.onchainMerchantId === null) continue
      const record = await client.readContract({
        address: registryAddress,
        abi: registryAbi,
        functionName: 'getMerchant',
        args: [BigInt(merchant.onchainMerchantId)],
      })
      registry.set(String(merchant.onchainMerchantId), {
        feeBps: record.feeBps,
        maxFeeBps: record.maxFeeBps,
      })
    }

    const report = auditMerchantTiers({ merchants, tierChanges, registry })
    print(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          chainId: await client.getChainId(),
          registryAddress,
          ...report,
        },
        null,
        2,
      ),
    )
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
