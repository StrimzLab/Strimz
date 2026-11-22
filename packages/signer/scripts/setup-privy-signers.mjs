#!/usr/bin/env node
// Sets up the mainnet Privy signer wallets (ADR-2026-11-22-privy-server-signers).
// Run from packages/signer after `pnpm build`. See docs/runbooks/privy-signers.md.
//
//   node scripts/setup-privy-signers.mjs wallets    create the three wallets; nobody can sign yet
//   node scripts/setup-privy-signers.mjs policies   after the contract deploy: attach the rules and
//                                                   the server key (needs the owner key)
//   node scripts/setup-privy-signers.mjs smoke      sign-only check of every rule; nothing is sent
//
// Secrets are read from the environment and never printed or written.
import { PrivyClient } from '@privy-io/node'
import { getTokenAddress, ARC_MAINNET_CHAIN_ID } from '@strimz/shared-config'
import { encodeFunctionData, getAddress, isAddress, parseAbiItem } from 'viem'

import {
  PrivyPolicyViolationError,
  privyWalletApi,
  REFUND_TRANSFER_CAP,
  signerFunctions,
  strimzSignerPolicies,
} from '../dist/index.js'

const say = (line) => process.stdout.write(`${line}\n`)
const ROLES = ['relayer', 'scheduler', 'refund']
const externalId = (role) => `strimz-mainnet-${role}`

function env(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

function contractEnv(name) {
  const value = env(name)
  if (!isAddress(value)) throw new Error(`${name} is not an address`)
  return getAddress(value)
}

function contracts() {
  return {
    payments: contractEnv('STRIMZ_PAYMENTS_ADDRESS'),
    subscriptions: contractEnv('STRIMZ_SUBSCRIPTIONS_ADDRESS'),
    registry: contractEnv('STRIMZ_REGISTRY_ADDRESS'),
    usdc: getTokenAddress('mainnet', 'USDC'),
    eurc: getTokenAddress('mainnet', 'EURC'),
  }
}

let privy

async function findWallet(role) {
  for await (const wallet of privy.wallets().list({ external_id: externalId(role) })) return wallet
  return null
}

async function wallets() {
  const owner = env('PRIVY_OWNER_KEY_QUORUM_ID')
  for (const role of ROLES) {
    let wallet = await findWallet(role)
    if (!wallet) {
      wallet = await privy.wallets().create({
        chain_type: 'ethereum',
        owner_id: owner,
        external_id: externalId(role),
        display_name: `Strimz mainnet ${role}`,
      })
    }
    say(`${role}: wallet ${wallet.id} address ${wallet.address}`)
  }
}

async function policies() {
  const owner = env('PRIVY_OWNER_KEY_QUORUM_ID')
  const signer = env('PRIVY_SIGNER_KEY_QUORUM_ID')
  const ownerKey = env('PRIVY_OWNER_AUTHORIZATION_KEY')
  const bodies = strimzSignerPolicies(contracts())
  for (const role of ROLES) {
    const wallet = await findWallet(role)
    if (!wallet) throw new Error(`no ${role} wallet: run the wallets step first`)
    if (wallet.policy_ids.length > 0) {
      say(`${role}: already has policy ${wallet.policy_ids.join(', ')}, skipped`)
      continue
    }
    const policy = await privy.policies().create({ ...bodies[role], owner_id: owner })
    await privy.wallets().update(wallet.id, {
      policy_ids: [policy.id],
      additional_signers: [{ signer_id: signer, override_policy_ids: [policy.id] }],
      authorization_context: { authorization_private_keys: [ownerKey] },
    })
    say(`${role}: policy ${policy.id} attached to ${wallet.id}, server key added`)
  }
}

function zero(type) {
  if (type.endsWith('[]')) return []
  if (type.startsWith('uint') || type.startsWith('int')) return 0n
  if (type === 'address') return '0x0000000000000000000000000000000000000001'
  if (type === 'bool') return false
  if (type === 'bytes' || type === 'string') return type === 'string' ? '' : '0x'
  if (type.startsWith('bytes')) return `0x${'00'.repeat(Number(type.slice(5)))}`
  throw new Error(`no zero value for ${type}`)
}

const args = (fn) =>
  fn.inputs.map((input) =>
    input.type === 'tuple'
      ? Object.fromEntries(input.components.map((c) => [c.name, zero(c.type)]))
      : zero(input.type),
  )

function tx(to, data, nonce) {
  return {
    type: 2,
    chain_id: ARC_MAINNET_CHAIN_ID,
    to,
    data,
    value: '0x0',
    nonce,
    gas_limit: '0x30d40',
    max_fee_per_gas: '0x5d21dba00',
    max_priority_fee_per_gas: '0x3b9aca00',
  }
}

async function smoke() {
  const api = privyWalletApi(privy, env('PRIVY_SIGNER_AUTHORIZATION_KEY'))
  const c = contracts()
  const call = (fn, overrides) =>
    encodeFunctionData({ abi: [fn], functionName: fn.name, args: overrides ?? args(fn) })
  const transfer = signerFunctions.refund[0]
  const stray = parseAbiItem('function approve(address spender, uint256 amount)')
  const targets = {
    relayer: [c.payments, c.subscriptions, c.subscriptions, c.registry, c.usdc],
    scheduler: [c.subscriptions, c.subscriptions, c.registry, c.registry],
    refund: [c.usdc],
  }
  let failures = 0
  const check = async (label, walletId, request, expectSigned) => {
    let signed = false
    try {
      await api.signTransaction(walletId, request)
      signed = true
    } catch (err) {
      if (!(err instanceof PrivyPolicyViolationError)) throw err
    }
    const ok = signed === expectSigned
    if (!ok) failures++
    say(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${signed ? 'signed' : 'refused'}`)
  }
  for (const role of ROLES) {
    const wallet = await findWallet(role)
    if (!wallet) throw new Error(`no ${role} wallet`)
    const fns = signerFunctions[role]
    for (const [i, fn] of fns.entries()) {
      await check(`${role} ${fn.name}`, wallet.id, tx(targets[role][i], call(fn), i), true)
    }
    await check(
      `${role} call to another contract`,
      wallet.id,
      tx('0x000000000000000000000000000000000000dEaD', call(fns[0]), 0),
      false,
    )
    await check(`${role} unlisted function`, wallet.id, tx(targets[role][0], call(stray), 0), false)
    await check(
      `${role} with value attached`,
      wallet.id,
      { ...tx(targets[role][0], call(fns[0]), 0), value: '0x1' },
      false,
    )
  }
  const refund = await findWallet('refund')
  const over = call(transfer, [
    '0x0000000000000000000000000000000000000001',
    REFUND_TRANSFER_CAP + 1n,
  ])
  await check('refund above the 5-token cap', refund.id, tx(c.usdc, over, 0), false)
  if (failures > 0) {
    console.error(`${failures} check(s) failed: do not grant roles to these wallets`)
    process.exit(1)
  }
  say('all checks passed')
}

const steps = { wallets, policies, smoke }
const step = steps[process.argv[2]]
if (!step) {
  console.error('usage: node scripts/setup-privy-signers.mjs wallets|policies|smoke')
  process.exit(2)
}
try {
  privy = new PrivyClient({ appId: env('PRIVY_APP_ID'), appSecret: env('PRIVY_APP_SECRET') })
  await step()
} catch (err) {
  console.error(`setup failed: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
}
