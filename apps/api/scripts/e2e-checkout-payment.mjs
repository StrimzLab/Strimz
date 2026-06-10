#!/usr/bin/env node
// End-to-end hosted-checkout payment flow, driven from a script instead
// of a browser.
//
// Walks every hop a real payer-driven checkout makes:
//   1. Merchant creates a live payment session via the secret API key.
//   2. Public checkout endpoint returns the session payload to the
//      "browser" (this script).
//   3. The payer signs an EIP-3009 ReceiveWithAuthorization message
//      with their wallet key. In production this happens client-side
//      via wagmi/Reown — here we use viem's local signer because the
//      e2e payer key is in packages/contracts/.env.
//   4. Browser submits the signed payload to the BFF; BFF forwards to
//      `POST /v1/relay/payments` with the merchant's secret API key.
//      We collapse the two-hop into a direct POST since this script
//      already holds the secret.
//   5. Poll `GET /v1/relay/submissions/{idempotencyKey}` until the
//      relay reports `confirmed`, `reverted`, or `failed`.
//   6. Read the on-chain payout-address balance to confirm the merchant
//      actually received the net amount.
//
// Usage:
//   pnpm --filter @strimz/api e2e:checkout-payment
//
// Required env (loaded from apps/api/.env via --env-file):
//   API_BASE_URL
//   ARC_RPC_URL
//   STRIMZ_USDC_ADDRESS         (defaults to Arc USDC if not set)
//   STRIMZ_PAYMENTS_ADDRESS
//
// Required env (loaded from packages/contracts/.env):
//   STRIMZ_PAYER_PRIVATE_KEY    payer's signing key
//
// Required positional/env:
//   STRIMZ_LIVE_API_KEY         a secret live key for the smoke merchant
//                               (the one seed-test-merchant printed)

import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { createPublicClient, http, stringToHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000'
const RPC_URL = process.env.ARC_RPC_URL ?? 'https://rpc.testnet.arc.network'
const USDC = (process.env.ARC_USDC_ADDRESS ?? '0x3600000000000000000000000000000000000000').toLowerCase()
const PAYMENTS = (process.env.STRIMZ_PAYMENTS_ADDRESS ?? '').toLowerCase()
const LIVE_KEY = process.env.STRIMZ_LIVE_API_KEY ?? process.argv[2]
const AMOUNT_BASE_UNITS = process.env.AMOUNT_BASE_UNITS ?? '1000000' // 1 USDC

if (!LIVE_KEY) {
  console.error(
    'STRIMZ_LIVE_API_KEY not set. Pass it as the first arg or export it before running.',
  )
  process.exit(2)
}
if (!PAYMENTS) {
  console.error('STRIMZ_PAYMENTS_ADDRESS not set in apps/api/.env.')
  process.exit(2)
}

// The payer's private key lives in packages/contracts/.env (test wallet
// from the contract e2e). Read it directly — pulling it through
// apps/api/.env would have it leak into the API process needlessly.
const payerKey = readEnv('packages/contracts/.env', 'STRIMZ_PAYER_PRIVATE_KEY')
if (!/^0x[0-9a-fA-F]{64}$/.test(payerKey)) {
  console.error('STRIMZ_PAYER_PRIVATE_KEY in packages/contracts/.env is malformed')
  process.exit(2)
}

const payer = privateKeyToAccount(payerKey)

console.log('============================================')
console.log('Strimz hosted-checkout e2e — payment flow')
console.log('============================================')
console.log(`API:        ${API_BASE}`)
console.log(`RPC:        ${RPC_URL}`)
console.log(`USDC:       ${USDC}`)
console.log(`Payments:   ${PAYMENTS}`)
console.log(`Payer:      ${payer.address}`)
console.log(`Amount:     ${AMOUNT_BASE_UNITS} (raw, 6 decimals)`)
console.log()

const publicClient = createPublicClient({ transport: http(RPC_URL) })

// ----- 1. Create payment session as the merchant -----
section(1, 'Merchant creates a LIVE payment session')

const sessionResp = await api('POST', '/v1/payment-sessions', {
  authToken: LIVE_KEY,
  body: {
    amount: AMOUNT_BASE_UNITS,
    currency: 'USDC',
    description: 'hosted-checkout e2e (scripted)',
    customer: { walletAddress: payer.address },
  },
})
console.log(`  id:               ${sessionResp.id}`)
console.log(`  chainMerchantId:  ${sessionResp.chainMerchantId}`)
console.log(`  amount:           ${sessionResp.amount}`)
console.log(`  feeAmount:        ${sessionResp.feeAmount}`)
console.log(`  netAmount:        ${sessionResp.netAmount}`)
if (!sessionResp.chainMerchantId) {
  fail('session has no chainMerchantId — MerchantChainService should have registered the merchant')
}

const sessionId = sessionResp.id
const chainMerchantId = sessionResp.chainMerchantId
const tokenAddress = sessionResp.tokenAddress.toLowerCase()
if (tokenAddress !== USDC) {
  fail(`session token (${tokenAddress}) != expected USDC (${USDC})`)
}

// ----- 2. Public checkout fetches the same payload -----
section(2, 'Public checkout endpoint returns the session (no auth)')
const publicSession = await api('GET', `/v1/checkout/sessions/${sessionId}`, { authToken: null })
if (publicSession.chainMerchantId !== chainMerchantId) {
  fail('public checkout returned a different chainMerchantId')
}
console.log('  ok — public payload matches')

// ----- 3. Sign the EIP-3009 ReceiveWithAuthorization -----
section(3, 'Payer signs ReceiveWithAuthorization (EIP-712)')

const payerBalanceBefore = await usdcBalanceOf(payer.address)

const validAfter = 0n
const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600)
const nonce = randomBytes32()
const amount = BigInt(AMOUNT_BASE_UNITS)

const signature = await payer.signTypedData({
  domain: await fetchUsdcDomain(),
  types: {
    ReceiveWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  },
  primaryType: 'ReceiveWithAuthorization',
  message: {
    from: payer.address,
    to: PAYMENTS,
    value: amount,
    validAfter,
    validBefore,
    nonce,
  },
})

const { v, r, s } = splitSignature(signature)
console.log(`  v=${v} r=${r.slice(0, 10)}… s=${s.slice(0, 10)}…`)

// ----- 4. Submit to the relay (mirrors what the web BFF does) -----
section(4, 'Submit signed payload to /v1/relay/payments')

const idempotencyKey = `e2e-${sessionId}-${Date.now()}`
// Session id as raw ASCII bytes, right-padded to bytes32. The indexer
// reverses this to link the on-chain Transaction back to the session.
const ref = stringToHex(sessionId, { size: 32 })

const relayResp = await api('POST', '/v1/relay/payments', {
  authToken: LIVE_KEY,
  body: {
    idempotencyKey,
    merchantId: chainMerchantId,
    token: USDC,
    auth: {
      from: payer.address,
      amount: amount.toString(),
      validAfter: validAfter.toString(),
      validBefore: validBefore.toString(),
      nonce,
    },
    ref,
    signature: { v, r, s },
    sessionId,
  },
})
console.log(`  status:           ${relayResp.status}`)
console.log(`  idempotencyKey:   ${relayResp.idempotencyKey}`)

// ----- 5. Poll the submission until confirmed -----
section(5, 'Poll /v1/relay/submissions until terminal state')

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

// ----- 6. Verify the on-chain effect -----
section(6, "Verify the payer's USDC balance dropped by exactly the auth amount")

const payerBalanceAfter = await usdcBalanceOf(payer.address)
const drop = payerBalanceBefore - payerBalanceAfter
console.log(`  payer before: ${payerBalanceBefore}  after: ${payerBalanceAfter}  drop: ${drop}`)
if (drop !== amount) {
  fail(`payer drop ${drop} != expected amount ${amount} (no gas: relayer pays it on EIP-3009)`)
}
console.log('  ok — drop matches authorisation amount exactly; relayer absorbed gas')

console.log()
console.log('=== ALL STAGES PASSED ===')

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
  // Pulled from the running USDC contract so a redeploy or a clone
  // chain doesn't silently desync the script.
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

async function usdcBalanceOf(address) {
  return publicClient.readContract({
    address: USDC,
    abi: [
      {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ type: 'address' }],
        outputs: [{ type: 'uint256' }],
      },
    ],
    functionName: 'balanceOf',
    args: [address],
  })
}

function readEnv(relativePath, key) {
  const root = process.env.STRIMZ_REPO_ROOT ?? resolvePath(process.cwd(), '..', '..')
  const text = readFileSync(resolvePath(root, relativePath), 'utf8')
  const match = text.match(new RegExp(`^${key}=(.+)$`, 'm'))
  if (!match) throw new Error(`${key} not found in ${relativePath}`)
  return match[1].replace(/^"(.*)"$/, '$1').trim()
}

function randomBytes32() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
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
