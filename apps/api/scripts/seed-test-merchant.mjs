#!/usr/bin/env node
// Seed a fully-prepared test merchant + a live secret API key, for curl
// smoke-testing against a running dev API. Idempotent on the email; safe
// to re-run. Prints the raw secret once (the API hashes it before storing,
// so it cannot be recovered later).
//
//   pnpm --filter @strimz/api seed:test-merchant
//
// Defaults can be overridden with env vars:
//   SEED_EMAIL            email + lookup key (default smoke@strimz.test)
//   SEED_BUSINESS_NAME    (default "Smoke Test Co")
//   SEED_WALLET_ADDRESS   on-chain owner / Registry `owner`
//                         (default 0xFd02…7150 — the e2e payer)
//   SEED_PAYOUT_ADDRESS   on-chain payout target
//                         (default 0xDB51…BB6C — the e2e payout)
//   SEED_TIER             free | growth | business | enterprise (default free)

import { createPrismaClient } from '@strimz/db'
import { generateApiKey } from '@strimz/shared-crypto'

const EMAIL = process.env.SEED_EMAIL ?? 'smoke@strimz.test'
const BUSINESS = process.env.SEED_BUSINESS_NAME ?? 'Smoke Test Co'
const WALLET = process.env.SEED_WALLET_ADDRESS ?? '0xFd0201bcd69FdBE0b1194C23bD64459121e07150'
const PAYOUT = process.env.SEED_PAYOUT_ADDRESS ?? '0xDB51809B2fF8B9D1D09EF3bBB832a425104FBB6C'
const TIER = process.env.SEED_TIER ?? 'free'

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

  const generated = await generateApiKey('secret', 'live')
  await prisma.merchantApiKey.create({
    data: {
      merchantId: merchant.id,
      name: 'smoke-test live key',
      kind: 'secret',
      mode: 'live',
      hash: generated.hash,
      prefix: generated.prefix,
      lastFour: generated.lastFour,
      scopes: SCOPES,
    },
  })

  console.log('--- merchant ---')
  console.log('id:               ', merchant.id)
  console.log('email:            ', merchant.email)
  console.log('walletAddress:    ', merchant.walletAddress)
  console.log('payoutAddress:    ', merchant.payoutAddress)
  console.log('tier:             ', merchant.tier)
  console.log('onchainMerchantId:', merchant.onchainMerchantId ?? '<unset; first live API call will register>')
  console.log('--- live secret API key (record now; cannot be recovered) ---')
  console.log(generated.secret)
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
