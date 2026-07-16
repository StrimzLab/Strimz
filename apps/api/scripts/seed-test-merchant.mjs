#!/usr/bin/env node
// Seed a fully-prepared test merchant + a live secret API key, for curl
// smoke-testing against a running dev API.
//
//   pnpm --filter @strimz/api seed:test-merchant
//
// Idempotent on the email AND on the API keys. Pass a fixed
// `SEED_SECRET_KEY` and/or `SEED_PUBLISHABLE_KEY` (the raw key strings)
// to make the seed pin those values so a peer app's `.env` stays
// valid across re-runs. Without them, the seed generates fresh
// random keys and prints them; every re-run mints new keys and
// leaves any prior smoke-test keys revoked.
//
//   SEED_EMAIL            email + lookup key (default smoke@strimz.test)
//   SEED_BUSINESS_NAME    (default "Smoke Test Co")
//   SEED_WALLET_ADDRESS   on-chain owner / Registry `owner`
//   SEED_PAYOUT_ADDRESS   on-chain payout target
//   SEED_TIER             free | growth | business | enterprise
//   SEED_SECRET_KEY       optional; pin the sk_live_... value
//   SEED_PUBLISHABLE_KEY  optional; pin the pk_live_... value

import { createPrismaClient } from '@strimz/db'
import { generateApiKey, hashApiKey } from '@strimz/shared-crypto'

const EMAIL = process.env.SEED_EMAIL ?? 'smoke@strimz.test'
const BUSINESS = process.env.SEED_BUSINESS_NAME ?? 'Smoke Test Co'
const WALLET = process.env.SEED_WALLET_ADDRESS ?? '0xFd0201bcd69FdBE0b1194C23bD64459121e07150'
const PAYOUT = process.env.SEED_PAYOUT_ADDRESS ?? '0xDB51809B2fF8B9D1D09EF3bBB832a425104FBB6C'
const TIER = process.env.SEED_TIER ?? 'free'
const PINNED_SECRET = process.env.SEED_SECRET_KEY
const PINNED_PUBLISHABLE = process.env.SEED_PUBLISHABLE_KEY

const SCOPES = [
  'sessions_read',
  'sessions_write',
  'subscriptions_read',
  'subscriptions_write',
  'refunds_read',
  'refunds_write',
  'transactions_read',
  'webhooks_read',
  'webhooks_write',
  'invoices_read',
  'invoices_write',
  'storefronts_read',
  'storefronts_write',
  'relay_read',
  'relay_write',
  'agents_read',
  'agents_write',
  'api_keys_read',
  'api_keys_write',
]

const prisma = createPrismaClient({ databaseUrl: process.env.DATABASE_URL })

async function main() {
  const merchant = await prisma.merchant.upsert({
    where: { email: EMAIL },
    update: {
      businessName: BUSINESS,
      walletAddress: WALLET,
      payoutAddress: PAYOUT,
      onboardingCompleted: true,
      emailVerified: true,
      twoFactorEnabled: true,
      tier: TIER,
      status: 'active',
      businessSector: 'Software',
      countryCode: 'US',
      onchainMerchantId: null,
    },
    create: {
      email: EMAIL,
      businessName: BUSINESS,
      walletAddress: WALLET,
      payoutAddress: PAYOUT,
      onboardingCompleted: true,
      emailVerified: true,
      twoFactorEnabled: true,
      tier: TIER,
      status: 'active',
      businessSector: 'Software',
      countryCode: 'US',
    },
  })

  // Revoke any prior smoke-test keys so re-runs never leave orphans.
  const now = new Date()
  await prisma.merchantApiKey.updateMany({
    where: {
      merchantId: merchant.id,
      revokedAt: null,
      name: { in: ['smoke-test live secret', 'smoke-test live publishable'] },
    },
    data: { revokedAt: now },
  })

  const secret = await ensureKey({
    pinned: PINNED_SECRET,
    kind: 'secret',
    mode: 'live',
    name: 'smoke-test live secret',
    merchantId: merchant.id,
    scopes: SCOPES,
  })
  const publishable = await ensureKey({
    pinned: PINNED_PUBLISHABLE,
    kind: 'publishable',
    mode: 'live',
    name: 'smoke-test live publishable',
    merchantId: merchant.id,
    scopes: ['sessions_read', 'transactions_read'],
  })

  console.log('--- merchant ---')
  console.log('id:               ', merchant.id)
  console.log('email:            ', merchant.email)
  console.log('walletAddress:    ', merchant.walletAddress)
  console.log('payoutAddress:    ', merchant.payoutAddress)
  console.log('tier:             ', merchant.tier)
  console.log('onchainMerchantId:', merchant.onchainMerchantId ?? '<unset; first live API call will register>')
  console.log('--- live secret API key ---')
  console.log(secret.printable ?? '<pinned; recover from SEED_SECRET_KEY>')
  console.log('--- live publishable key ---')
  console.log(publishable.printable ?? '<pinned; recover from SEED_PUBLISHABLE_KEY>')
}

async function ensureKey({ pinned, kind, mode, name, merchantId, scopes }) {
  if (pinned) {
    const hash = await hashApiKey(pinned)
    const prefix = pinned.slice(0, 12)
    const lastFour = pinned.slice(-4)
    await prisma.merchantApiKey.deleteMany({ where: { hash } })
    await prisma.merchantApiKey.create({
      data: { merchantId, name, kind, mode, hash, prefix, lastFour, scopes },
    })
    return { printable: null }
  }
  const fresh = await generateApiKey(kind, mode)
  await prisma.merchantApiKey.create({
    data: {
      merchantId,
      name,
      kind,
      mode,
      hash: fresh.hash,
      prefix: fresh.prefix,
      lastFour: fresh.lastFour,
      scopes,
    },
  })
  return { printable: fresh.secret }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
