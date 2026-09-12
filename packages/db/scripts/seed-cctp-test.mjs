/**
 * Seeds the minimum needed to exercise cross-chain checkout funding
 * end to end: an active merchant with an on-chain registry id, a
 * secret API key carrying `relay_write`, and an open payment session.
 *
 * Idempotent on the merchant email — re-running reuses the merchant
 * and mints a fresh key and session.
 *
 *   node scripts/seed-cctp-test.mjs --payout 0xYourAddress
 *
 * Options:
 *   --payout   <address>  merchant payout + owner address (required)
 *   --amount   <usdc>     session amount in whole USDC     (default 1)
 *   --email    <email>    merchant email                   (default seed+cctp@strimz.local)
 *   --onchain  <int>      registry merchant id             (default 1)
 *   --expires  <minutes>  session lifetime                 (default 180)
 *
 * When ARC_RPC_URL and STRIMZ_REGISTRY_ADDRESS are set, the script
 * reads the on-chain merchant and refuses to seed if its payout
 * address is not the one you passed. The Registry is what the Payments
 * contract actually pays; the row in Postgres is display only. Getting
 * this wrong means a settled test payment lands in someone else's
 * wallet, which is not recoverable. Pass --skip-registry-check to seed
 * anyway (fine for funding-step tests, which never reach settlement).
 *
 * The long default expiry is deliberate. A standard-finality CCTP
 * transfer can take ~13 minutes, and a session that dies mid-bridge
 * leaves the payer holding Arc USDC they cannot spend on it.
 */

import { randomBytes, createHash } from 'node:crypto'
import { parseArgs } from 'node:util'
// The package's own factory, so this script gets the same driver
// adapter and pool settings the apps run with. Requires a build:
//   pnpm --filter @strimz/db build
import { createPrismaClient } from '../dist/src/index.js'

const { values } = parseArgs({
  options: {
    payout: { type: 'string' },
    amount: { type: 'string', default: '1' },
    email: { type: 'string', default: 'seed+cctp@strimz.local' },
    onchain: { type: 'string', default: '1' },
    expires: { type: 'string', default: '180' },
    'skip-registry-check': { type: 'boolean', default: false },
  },
})

const payout = values.payout
if (!payout || !/^0x[0-9a-fA-F]{40}$/.test(payout)) {
  console.error('error: --payout 0x<40 hex> is required')
  process.exit(1)
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('error: DATABASE_URL is not set (packages/db/.env)')
  process.exit(1)
}

/** Matches `sha256Hex` in @strimz/shared-crypto, which is what the guard uses. */
const hashApiKey = (secret) => createHash('sha256').update(secret).digest('hex')

/** Base62, same shape the api-keys module mints. */
function mintSecretKey() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(32)
  let body = ''
  for (const b of bytes) body += alphabet[b % alphabet.length]
  return `sk_test_${body}`
}

/**
 * Reads `getMerchant(uint256)` straight off the Registry over JSON-RPC.
 * The struct is all-static, so `payoutAddress` is the fourth 32-byte
 * word and can be sliced without an ABI decoder.
 */
async function onchainPayoutAddress(rpcUrl, registry, merchantId) {
  const selector = '0x5d32798a'
  const arg = BigInt(merchantId).toString(16).padStart(64, '0')
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: registry, data: `${selector}${arg}` }, 'latest'],
    }),
  })
  const body = await res.json()
  if (body.error) {
    // `getMerchant` reverts on an id that was never registered rather
    // than returning a zero struct, so a revert here is the normal
    // "no such merchant" answer, not an infrastructure failure.
    if (/revert/i.test(body.error.message ?? '')) return null
    throw new Error(`registry read failed: ${body.error.message}`)
  }
  const data = String(body.result ?? '').slice(2)
  if (data.length < 64 * 4) return null
  const word = data.slice(64 * 3, 64 * 4)
  const addr = `0x${word.slice(24)}`
  return addr === '0x0000000000000000000000000000000000000000' ? null : addr
}

const prisma = createPrismaClient({ databaseUrl })

async function main() {
  const amountBaseUnits = BigInt(Math.round(Number(values.amount) * 1_000_000))
  if (amountBaseUnits <= 0n) throw new Error('--amount must be greater than zero')

  // Free-tier one-shot rate. Only the arithmetic matters here; the API
  // recomputes it from the merchant tier on real sessions.
  const feeBps = 150n
  const feeAmount = (amountBaseUnits * feeBps) / 10_000n
  const netAmount = amountBaseUnits - feeAmount

  const rpcUrl = process.env.ARC_RPC_URL
  const registry = process.env.STRIMZ_REGISTRY_ADDRESS
  if (!values['skip-registry-check'] && rpcUrl && registry) {
    const onchain = await onchainPayoutAddress(rpcUrl, registry, values.onchain)
    if (!onchain) {
      throw new Error(
        `on-chain merchant ${values.onchain} is not registered on ${registry}. ` +
          'Pass --onchain <id> for a merchant that exists, or --skip-registry-check.',
      )
    }
    if (onchain.toLowerCase() !== payout.toLowerCase()) {
      throw new Error(
        `on-chain merchant ${values.onchain} pays out to ${onchain}, not ${payout}.\n` +
          'A settled payment would go to that address, not yours. Either register\n' +
          'yourself and pass --onchain <your id>, or pass --skip-registry-check if\n' +
          'you are only testing the funding step (it never reaches settlement).',
      )
    }
    console.log(`registry check: merchant ${values.onchain} pays out to ${onchain} ✓`)
  }

  const merchant = await prisma.merchant.upsert({
    where: { email: values.email },
    update: {
      status: 'active',
      onchainMerchantId: Number(values.onchain),
      walletAddress: payout,
      payoutAddress: payout,
    },
    create: {
      email: values.email,
      businessName: 'CCTP Test Merchant',
      status: 'active',
      emailVerified: true,
      onboardingCompleted: true,
      onchainMerchantId: Number(values.onchain),
      walletAddress: payout,
      payoutAddress: payout,
      arcEnvironment: 'testnet',
      defaultCurrency: 'USDC',
    },
  })

  const secret = mintSecretKey()
  const apiKey = await prisma.merchantApiKey.create({
    data: {
      merchantId: merchant.id,
      name: 'cctp seed key',
      kind: 'secret',
      mode: 'test',
      hash: hashApiKey(secret),
      prefix: secret.slice(0, 12),
      lastFour: secret.slice(-4),
      scopes: ['relay_read', 'relay_write', 'sessions_read', 'sessions_write', 'transactions_read'],
    },
  })

  const checkoutOrigin = process.env.CHECKOUT_ORIGIN ?? 'http://localhost:3000'
  const session = await prisma.paymentSession.create({
    data: {
      merchantId: merchant.id,
      status: 'created',
      amount: amountBaseUnits.toString(),
      currency: 'USDC',
      feeAmount: feeAmount.toString(),
      netAmount: netAmount.toString(),
      description: 'CCTP cross-chain funding test',
      mode: 'test',
      checkoutUrl: 'pending',
      expiresAt: new Date(Date.now() + Number(values.expires) * 60_000),
    },
  })
  await prisma.paymentSession.update({
    where: { id: session.id },
    data: { checkoutUrl: `${checkoutOrigin.replace(/\/$/, '')}/pay/${session.id}` },
  })

  console.log(`
merchant      ${merchant.id}
  email       ${merchant.email}
  onchain id  ${merchant.onchainMerchantId}
  payout      ${merchant.payoutAddress}

api key       ${apiKey.id}
  secret      ${secret}
              ^ shown once. Put this in apps/web/.env as STRIMZ_INTERNAL_API_KEY.

session       ${session.id}
  amount      ${values.amount} USDC (${amountBaseUnits} base units)
  expires     ${new Date(Date.now() + Number(values.expires) * 60_000).toISOString()}
  checkout    ${checkoutOrigin.replace(/\/$/, '')}/pay/${session.id}

Preflight the bridge endpoint:
  curl -s localhost:4000/v1/relay/bridges/${session.id} \\
    -H "authorization: Bearer ${secret}" | jq

Record a burn (after you have a real burn tx on Arbitrum Sepolia):
  curl -s -XPOST localhost:4000/v1/relay/bridges \\
    -H "authorization: Bearer ${secret}" \\
    -H 'content-type: application/json' \\
    -d '{"sessionId":"${session.id}","sourceChain":"arbitrum","burnTxHash":"0x<BURN_TX>"}' | jq
`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
