#!/usr/bin/env node
// End-to-end hosted-checkout SUBSCRIPTION enrolment flow, driven from a
// script instead of a browser. Mirrors e2e-checkout-payment.mjs.
//
// Walks every hop the hosted subscription checkout makes:
//   1. Merchant creates a SubscriptionPlan via the secret API key.
//   2. Public `/v1/checkout/plans/:id` returns the plan payload to the
//      "browser" (this script).
//   3. The payer signs an EIP-2612 `Permit` granting the Subscriptions
//      contract a max allowance on USDC.
//   4. Browser POSTs the signed payload to the BFF; BFF forwards to
//      `POST /v1/relay/subscriptions` with the secret API key. We
//      collapse the BFF hop and call the API directly.
//   5. Poll `GET /v1/relay/submissions/{idempotencyKey}` until the
//      relay reports `confirmed` / `reverted` / `failed`.
//   6. Verify on-chain by reading the new subscription via the
//      `Subscriptions.getSubscription` view.
//
// Usage:
//   pnpm --filter @strimz/api e2e:checkout-subscription
//
// Required env: STRIMZ_LIVE_API_KEY (secret live key for the smoke
// merchant). Everything else lives in apps/api/.env +
// packages/contracts/.env.

import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import {
  createPublicClient,
  http,
  maxUint256,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000'
const RPC_URL = process.env.ARC_RPC_URL ?? 'https://rpc.testnet.arc.network'
const USDC = (process.env.ARC_USDC_ADDRESS ?? '0x3600000000000000000000000000000000000000').toLowerCase()
const SUBSCRIPTIONS = (process.env.STRIMZ_SUBSCRIPTIONS_ADDRESS ?? '').toLowerCase()
const LIVE_KEY = process.env.STRIMZ_LIVE_API_KEY ?? process.argv[2]
const PLAN_AMOUNT_BASE_UNITS = process.env.PLAN_AMOUNT_BASE_UNITS ?? '2500000' // 2.5 USDC / interval
// Plan interval — must satisfy MIN_INTERVAL on StrimzSubscriptions
// (1 hour). "daily" maps to 86400s which is well above.
const PLAN_INTERVAL = process.env.PLAN_INTERVAL ?? 'daily'

if (!LIVE_KEY) {
  console.error('STRIMZ_LIVE_API_KEY not set. Pass it as the first arg or export it first.')
  process.exit(2)
}
if (!SUBSCRIPTIONS) {
  console.error('STRIMZ_SUBSCRIPTIONS_ADDRESS not set in apps/api/.env.')
  process.exit(2)
}

const payerKey = readEnv('packages/contracts/.env', 'STRIMZ_PAYER_PRIVATE_KEY')
if (!/^0x[0-9a-fA-F]{64}$/.test(payerKey)) {
  console.error('STRIMZ_PAYER_PRIVATE_KEY in packages/contracts/.env is malformed')
  process.exit(2)
}
const payer = privateKeyToAccount(payerKey)
const publicClient = createPublicClient({ transport: http(RPC_URL) })

console.log('============================================')
console.log('Strimz hosted-checkout e2e — subscription enrolment')
console.log('============================================')
console.log(`API:           ${API_BASE}`)
console.log(`RPC:           ${RPC_URL}`)
console.log(`USDC:          ${USDC}`)
console.log(`Subscriptions: ${SUBSCRIPTIONS}`)
console.log(`Payer:         ${payer.address}`)
console.log(`Interval:      ${PLAN_INTERVAL}`)
console.log(`Plan amount:   ${PLAN_AMOUNT_BASE_UNITS} (raw, 6 decimals)`)
console.log()

// ----- 1. Merchant creates a SubscriptionPlan -----
section(1, 'Merchant creates a subscription plan')

const plan = await api('POST', '/v1/subscription-plans', {
  authToken: LIVE_KEY,
  body: {
    name: 'e2e smoke daily plan',
    amount: PLAN_AMOUNT_BASE_UNITS,
    currency: 'USDC',
    interval: PLAN_INTERVAL,
  },
})
console.log(`  plan id:          ${plan.id}`)
console.log(`  amount:           ${plan.amount}`)
console.log(`  intervalSeconds:  ${plan.intervalSeconds}`)
console.log(`  chainMerchantId:  ${plan.chainMerchantId}`)
console.log(`  tokenAddress:     ${plan.tokenAddress}`)
if (!plan.chainMerchantId) {
  fail('plan has no chainMerchantId — MerchantChainService should have registered the merchant')
}

// ----- 2. Public checkout endpoint returns the same payload -----
section(2, 'Public /v1/checkout/plans/:id returns matching payload')
const publicPlan = await api('GET', `/v1/checkout/plans/${plan.id}`, { authToken: null })
if (publicPlan.chainMerchantId !== plan.chainMerchantId) {
  fail('public plan returned a different chainMerchantId')
}
console.log('  ok — public payload matches')

// ----- 3. Payer signs the EIP-2612 Permit -----
section(3, 'Payer signs Permit (EIP-712)')

const domain = await fetchUsdcDomain()
const nonceResp = await api('GET', `/v1/tokens/${USDC}/permit-nonce?owner=${payer.address}`, {
  authToken: null,
})
const nonce = BigInt(nonceResp.nonce)
const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)
const value = maxUint256

const signature = await payer.signTypedData({
  domain,
  types: {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  primaryType: 'Permit',
  message: {
    owner: payer.address,
    spender: SUBSCRIPTIONS,
    value,
    nonce,
    deadline,
  },
})
const { v, r, s } = splitSignature(signature)
console.log(`  v=${v} r=${r.slice(0, 10)}… s=${s.slice(0, 10)}…  nonce=${nonce}`)

// ----- 4. Submit to /v1/relay/subscriptions -----
section(4, 'Submit signed permit + enrolment to /v1/relay/subscriptions')

const idempotencyKey = `e2e-sub-${plan.id}-${Date.now()}`
const relayResp = await api('POST', '/v1/relay/subscriptions', {
  authToken: LIVE_KEY,
  body: {
    idempotencyKey,
    merchantId: plan.chainMerchantId,
    token: USDC,
    amount: plan.amount,
    interval: plan.intervalSeconds,
    startAt: '0',
    endAt: '0',
    permitData: {
      owner: payer.address,
      value: value.toString(),
      deadline: deadline.toString(),
    },
    signature: { v, r, s },
    subscriptionInternalId: plan.id,
  },
})
console.log(`  status:           ${relayResp.status}`)
console.log(`  idempotencyKey:   ${relayResp.idempotencyKey}`)

// ----- 5. Poll until terminal state -----
section(5, 'Poll /v1/relay/submissions until terminal')
let final = relayResp
for (let i = 0; i < 60 && !isTerminal(final.status); i++) {
  await sleep(1000)
  final = await api('GET', `/v1/relay/submissions/${encodeURIComponent(idempotencyKey)}`, {
    authToken: LIVE_KEY,
  })
  process.stdout.write(`\r  attempt ${i + 1}: status=${final.status} txHash=${final.txHash ?? '—'}    `)
}
process.stdout.write('\n')
if (final.status !== 'confirmed') {
  fail(`relay did not confirm — final status=${final.status} reason=${final.errorReason ?? '—'}`)
}
console.log(`  txHash:           ${final.txHash}`)

// ----- 6. Verify on-chain via Subscriptions.getSubscription -----
section(6, 'Verify on-chain subscription state')

const subscriptionId = await getSubscriptionIdFromReceipt(final.txHash)
console.log(`  on-chain subscriptionId: ${subscriptionId}`)

const sub = await publicClient.readContract({
  address: SUBSCRIPTIONS,
  abi: [
    {
      type: 'function',
      name: 'getSubscription',
      stateMutability: 'view',
      inputs: [{ name: 'subscriptionId', type: 'uint256' }],
      outputs: [
        {
          type: 'tuple',
          components: [
            { name: 'payer', type: 'address' },
            { name: 'nextChargeAt', type: 'uint64' },
            { name: 'interval', type: 'uint32' },
            { name: 'token', type: 'address' },
            // merchantId is packed with `token` in storage (uint96) so
            // the contract's struct keeps four EVM slots. `amount` is
            // its own full-width uint256 slot.
            { name: 'merchantId', type: 'uint96' },
            { name: 'amount', type: 'uint256' },
            { name: 'endAt', type: 'uint64' },
            { name: 'cancelled', type: 'bool' },
          ],
        },
      ],
    },
  ],
  functionName: 'getSubscription',
  args: [subscriptionId],
})

const checks = [
  ['payer', sub.payer.toLowerCase(), payer.address.toLowerCase()],
  ['interval', String(sub.interval), String(plan.intervalSeconds)],
  ['token', sub.token.toLowerCase(), USDC],
  ['merchantId', String(sub.merchantId), plan.chainMerchantId],
  ['amount', String(sub.amount), plan.amount],
  ['cancelled', String(sub.cancelled), 'false'],
]
for (const [name, actual, expected] of checks) {
  if (actual !== expected) {
    fail(`${name} mismatch — got ${actual}, want ${expected}`)
  }
  console.log(`  ok ${name} = ${actual}`)
}

console.log()
console.log('=== ALL STAGES PASSED ===')
console.log()
console.log(`subscription id on-chain: ${subscriptionId}`)
console.log(
  '\nNext: backdate Subscription.nextChargeAt in Postgres, hit',
  'POST /admin/sweep-now on the scheduler, and watch the on-chain',
  'batchCharge tx land.',
)

// ---- helpers ----

async function api(method, path, { authToken, body } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (authToken) headers.authorization = `Bearer ${authToken}`
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = text ? JSON.parse(text) : null } catch { json = text }
  if (!res.ok) {
    console.error(`  ${method} ${path} → HTTP ${res.status}`)
    console.error('  ' + (typeof json === 'string' ? json : JSON.stringify(json, null, 2)))
    process.exit(1)
  }
  return json
}

async function fetchUsdcDomain() {
  const [name, version, chainId] = await Promise.all([
    publicClient.readContract({
      address: USDC,
      abi: [{ name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }],
      functionName: 'name',
    }),
    publicClient.readContract({
      address: USDC,
      abi: [{ name: 'version', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }],
      functionName: 'version',
    }),
    publicClient.getChainId(),
  ])
  return { name, version, chainId, verifyingContract: USDC }
}

async function getSubscriptionIdFromReceipt(txHash) {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash })
  // SubscriptionCreated(subscriptionId indexed, merchantId indexed,
  //                     payer indexed, token, amount, interval, endAt)
  // topic[1] = subscriptionId.
  const SIG = '0x' + (await keccakHex(
    'SubscriptionCreated(uint256,uint256,address,address,uint256,uint32,uint64)'
  ))
  for (const lg of receipt.logs) {
    if (lg.address.toLowerCase() !== SUBSCRIPTIONS) continue
    if (lg.topics[0] !== SIG) continue
    return BigInt(lg.topics[1])
  }
  throw new Error(`SubscriptionCreated event not found in tx ${txHash}`)
}

async function keccakHex(s) {
  const { keccak256, toHex } = await import('viem')
  return keccak256(toHex(s)).slice(2)
}

function readEnv(relativePath, key) {
  const root = process.env.STRIMZ_REPO_ROOT ?? resolvePath(process.cwd(), '..', '..')
  const text = readFileSync(resolvePath(root, relativePath), 'utf8')
  const match = text.match(new RegExp(`^${key}=(.+)$`, 'm'))
  if (!match) throw new Error(`${key} not found in ${relativePath}`)
  return match[1].replace(/^"(.*)"$/, '$1').trim()
}

function splitSignature(sig) {
  if (!/^0x[0-9a-fA-F]{130}$/.test(sig)) throw new Error(`malformed signature: ${sig}`)
  return {
    r: '0x' + sig.slice(2, 66),
    s: '0x' + sig.slice(66, 130),
    v: parseInt(sig.slice(130, 132), 16),
  }
}

function isTerminal(status) {
  return status === 'confirmed' || status === 'reverted' || status === 'failed'
}

function section(n, title) {
  console.log()
  console.log(`[${n}] ${title}`)
}

function fail(msg) {
  console.error(`  FAIL: ${msg}`)
  process.exit(1)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
