import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AdminRole } from '@strimz/db'
import {
  decodeFunctionData,
  getAddress,
  keccak256,
  parseTransaction,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { must } from '../helpers/must.js'
import { makePrivyDid } from '../helpers/stubs/privy.stub.js'
import { GasPricingService } from '../../src/modules/relay/gas-pricing.service.js'
import { NonceManager } from '../../src/modules/relay/nonce-manager.service.js'
import { safeAbis } from '../../src/modules/safe/safe-abi.js'
import { safeTxHash, safeTypedData, type SafeTx } from '../../src/modules/safe/safe-tx.js'

const a = (n: number) => getAddress(`0x${n.toString(16).padStart(40, '0')}`)
const SAFE = a(0x5afe)
const TIMELOCK = a(0x71)
// The shared test setup already sets the core contract addresses.
const contract = (name: string) => getAddress(must(process.env[name], name))
const CHAIN_ID = 5042002

const alice = privateKeyToAccount(`0x${'11'.repeat(32)}`)
const bob = privateKeyToAccount(`0x${'22'.repeat(32)}`)
const carol = privateKeyToAccount(`0x${'33'.repeat(32)}`)
const mallory = privateKeyToAccount(`0x${'44'.repeat(32)}`)

const tokenFor = (email: string) => `test|${makePrivyDid(email)}|${email}|`

// A Safe as the chain would report it; the service reads everything through the client.
class FakeSafe {
  owners: Address[] = [alice.address, bob.address, carol.address]
  threshold = 2n
  nonce = 3n
  lieAboutHash = false
  sent: Hex[] = []
  receiptStatus: 'success' | 'reverted' = 'success'

  read(args: { functionName: string; args?: readonly unknown[] }): unknown {
    switch (args.functionName) {
      case 'getOwners':
        return this.owners
      case 'getThreshold':
        return this.threshold
      case 'nonce':
        return this.nonce
      case 'getMinDelay':
        return 172_800n
      case 'paused':
        return false
      case 'getTimestamp':
        return 0n
      case 'getTransactionHash': {
        const [to, value, data, operation, , , , , , nonce] = args.args as [
          Address,
          bigint,
          Hex,
          0,
          ...unknown[],
        ]
        const tx: SafeTx = { to, value, data, operation, nonce: nonce as bigint }
        return this.lieAboutHash ? keccak256('0x01') : safeTxHash(CHAIN_ID, SAFE, tx)
      }
      default:
        throw new Error(`FakeSafe cannot read ${args.functionName}`)
    }
  }
}

describe('Safe console (ADR-2026-11-23-safe-console)', () => {
  let t: TestApp
  let safe: FakeSafe

  beforeAll(async () => {
    Object.assign(process.env, {
      STRIMZ_FEE_COLLECTOR_ADDRESS: a(0xa5),
      STRIMZ_SAFE_ADDRESS: SAFE,
      TIMELOCK_ADDRESS: TIMELOCK,
      STRIMZ_GUARDIAN_ADDRESS: alice.address,
    })
    t = await createTestApp()
    const nonces = t.app.get(NonceManager, { strict: false })
    nonces.acquire = () => Promise.resolve(0n)
    nonces.resync = () => Promise.resolve()
    const gas = t.app.get(GasPricingService, { strict: false })
    gas.compute = () => Promise.resolve({ maxFeePerGas: 2n, maxPriorityFeePerGas: 1n })
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    safe = new FakeSafe()
    Object.assign(t.chain.client as object, {
      readContract: (args: { functionName: string; args?: readonly unknown[] }) =>
        Promise.resolve().then(() => safe.read(args)),
      estimateGas: () => Promise.resolve(200_000n),
      sendRawTransaction: ({ serializedTransaction }: { serializedTransaction: Hex }) => {
        safe.sent.push(serializedTransaction)
        return Promise.resolve(keccak256(serializedTransaction))
      },
      waitForTransactionReceipt: ({ hash }: { hash: Hex }) =>
        Promise.resolve({ transactionHash: hash, status: safe.receiptStatus, blockNumber: 9n }),
    })
    for (const [email, role] of [
      ['owner@strimz.test', 'super_admin'],
      ['ops@strimz.test', 'admin'],
    ] as const) {
      await t.prisma.db.adminUser.create({
        data: { email, role: role as AdminRole, privyUserId: makePrivyDid(email) },
      })
    }
  })

  const call = (method: 'GET' | 'POST', url: string, body?: unknown, email = 'owner@strimz.test') =>
    t.inject({
      method,
      url: `/v1/admin/safe${url}`,
      headers: { authorization: `Bearer ${tokenFor(email)}` },
      ...(body === undefined ? {} : { payload: body as object }),
    })

  const propose = async (action: object) => {
    const res = await call('POST', '/proposals', { action })
    expect(res.statusCode, res.body).toBe(201)
    return res.json<{ id: string; to: Address; data: Hex; nonce: number; safeTxHash: Hex }>()
  }

  const signAs = (account: typeof alice, p: { to: Address; data: Hex; nonce: number }) =>
    account.signTypedData(
      safeTypedData(CHAIN_ID, SAFE, {
        to: p.to,
        value: 0n,
        data: p.data,
        operation: 0,
        nonce: BigInt(p.nonce),
      }),
    )

  const submit = (id: string, signature: Hex) =>
    call('POST', `/proposals/${id}/signatures`, { signature })

  it('is for super admins only', async () => {
    const res = await call('GET', '', undefined, 'ops@strimz.test')
    expect(res.statusCode).toBe(403)
  })

  it('shows the Safe as the chain reports it', async () => {
    const res = await call('GET', '')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      safe: SAFE,
      owners: [alice.address, bob.address, carol.address],
      threshold: 2,
      nonce: 3,
      timelockDelaySeconds: 172_800,
    })
  })

  it('accepts only menu actions', async () => {
    const res = await call('POST', '/proposals', {
      action: { kind: 'call', to: SAFE, data: '0xdeadbeef' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('proposes at the Safe nonce, with the hash the Safe computes, and logs it', async () => {
    const p = await propose({ kind: 'pause', contract: 'payments' })
    expect(p).toMatchObject({
      to: contract('STRIMZ_PAYMENTS_ADDRESS'),
      nonce: 3,
      status: 'collecting',
    })
    expect(p.safeTxHash).toBe(
      safeTxHash(CHAIN_ID, SAFE, { to: p.to, value: 0n, data: p.data, operation: 0, nonce: 3n }),
    )
    const audit = await t.prisma.db.auditLog.findMany({ where: { action: 'safe.proposed' } })
    expect(audit).toHaveLength(1)
  })

  it('saves nothing when the Safe disagrees about the hash', async () => {
    safe.lieAboutHash = true
    const res = await call('POST', '/proposals', {
      action: { kind: 'pause', contract: 'payments' },
    })
    expect(res.statusCode).toBe(503)
    expect(await t.prisma.db.safeProposal.count()).toBe(0)
  })

  it('takes signatures only from current owners, once each, for this transaction', async () => {
    const p = await propose({ kind: 'pause', contract: 'payments' })

    const outsider = await submit(p.id, await signAs(mallory, p))
    expect(outsider.statusCode).toBe(400)
    expect(outsider.json()).toMatchObject({ error: { code: 'not_an_owner' } })

    const otherNonce = await submit(p.id, await signAs(alice, { ...p, nonce: 4 }))
    expect(otherNonce.statusCode).toBe(400)

    const first = await submit(p.id, await signAs(alice, p))
    expect(first.statusCode).toBe(200)
    expect(first.json()).toMatchObject({ status: 'collecting' })

    const again = await submit(p.id, await signAs(alice, p))
    expect(again.statusCode).toBe(409)
    expect(again.json()).toMatchObject({ error: { code: 'already_signed' } })

    const second = await submit(p.id, await signAs(bob, p))
    expect(second.json()).toMatchObject({ status: 'ready' })
  })

  it('will not execute before enough owners sign', async () => {
    const p = await propose({ kind: 'pause', contract: 'payments' })
    await submit(p.id, await signAs(alice, p))
    const res = await call('POST', `/proposals/${p.id}/execute`)
    expect(res.statusCode).toBe(409)
    expect(safe.sent).toHaveLength(0)
  })

  it('executes from the relayer with sorted signatures and no gas refund', async () => {
    const p = await propose({ kind: 'unpause', contract: 'subscriptions' })
    const bobSig = await signAs(bob, p)
    const carolSig = await signAs(carol, p)
    await submit(p.id, carolSig)
    await submit(p.id, bobSig)

    const res = await call('POST', `/proposals/${p.id}/execute`)
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json()).toMatchObject({ status: 'executed' })

    expect(safe.sent).toHaveLength(1)
    const raw = must(safe.sent[0], 'the sent transaction')
    const tx = parseTransaction(raw)
    expect(getAddress(must(tx.to, 'to'))).toBe(SAFE)
    const { args } = decodeFunctionData({ abi: safeAbis.safe, data: must(tx.data, 'data') })
    expect(args?.[6]).toBe(0n)
    const [low, high] =
      BigInt(bob.address) < BigInt(carol.address) ? [bobSig, carolSig] : [carolSig, bobSig]
    expect(args?.[9]).toBe(`${low}${high.slice(2)}`)
    expect(res.json<{ executeTxHash: Hex }>().executeTxHash).toBe(keccak256(raw))

    const audit = await t.prisma.db.auditLog.findMany({ where: { action: 'safe.executed' } })
    expect(audit).toHaveLength(1)
  })

  it('marks a proposal stale once the Safe has moved past its nonce', async () => {
    const p = await propose({ kind: 'pause', contract: 'payments' })
    safe.nonce = 4n
    const res = await submit(p.id, await signAs(alice, p))
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { code: 'stale_proposal' } })
    const row = await t.prisma.db.safeProposal.findUniqueOrThrow({ where: { id: p.id } })
    expect(row.status).toBe('stale')
  })

  it('ignores a removed owner’s signature at execute time', async () => {
    const p = await propose({ kind: 'pause', contract: 'payments' })
    await submit(p.id, await signAs(alice, p))
    await submit(p.id, await signAs(bob, p))
    safe.owners = [alice.address, carol.address]
    const res = await call('POST', `/proposals/${p.id}/execute`)
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { code: 'not_enough_signatures' } })
    expect(safe.sent).toHaveLength(0)
  })

  it('records a reverted execute as failed', async () => {
    safe.receiptStatus = 'reverted'
    const p = await propose({ kind: 'pause', contract: 'payments' })
    await submit(p.id, await signAs(alice, p))
    await submit(p.id, await signAs(bob, p))
    const res = await call('POST', `/proposals/${p.id}/execute`)
    expect(res.json()).toMatchObject({ status: 'failed' })
  })

  it('schedules top-level role changes through the Timelock and runs them only when ready', async () => {
    const p = await propose({
      kind: 'revokeRole',
      contract: 'payments',
      role: 'PAUSER_ROLE',
      account: carol.address,
    })
    expect(p.to).toBe(TIMELOCK)
    const early = await call('POST', `/proposals/${p.id}/timelock-execute`)
    expect(early.statusCode).toBe(409)
    expect(early.json()).toMatchObject({ error: { code: 'not_scheduled' } })
  })
})
