import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import type { MerchantTier } from '@strimz/db'
import type { Hex } from 'viem'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant } from '../helpers/fixtures.js'

const WALLET = '0x00000000000000000000000000000000000000c1'
const ZERO = '0x0000000000000000000000000000000000000000'

type ReadArgs = { address: Hex; functionName: string; args?: readonly unknown[] }
type ChainClient = { readContract: (args: ReadArgs) => Promise<unknown> }

describe('session fees follow the merchant plan', () => {
  let t: TestApp
  let client: ChainClient
  let originalRead: ChainClient['readContract']
  let registryFeeBps: number | null

  beforeAll(async () => {
    t = await createTestApp()
    client = t.chain.client as unknown as ChainClient
    originalRead = client.readContract
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.queue.reset()
    registryFeeBps = null
    client.readContract = (args) => {
      if (args.functionName !== 'getMerchant') return originalRead(args)
      if (registryFeeBps === null) return Promise.reject(new Error('rpc unavailable'))
      return Promise.resolve({
        owner: WALLET,
        feeBps: registryFeeBps,
        active: true,
        payoutAddress: '0x000000000000000000000000000000000000beef',
        parentMerchantId: 0n,
        pendingOwner: ZERO,
        pendingPayoutAddress: ZERO,
        payoutChangeCommitAt: 0n,
        maxFeeBps: 50,
      })
    }
  })
  afterEach(() => {
    client.readContract = originalRead
  })

  async function createSession(tier: MerchantTier, amount: string) {
    const m = await seedMerchant(t.prisma.db, {
      tier,
      onboardingCompleted: true,
      walletAddress: WALLET,
      onchainMerchantId: 1,
    })
    const k = await seedApiKey(t.prisma.db, m.id)
    return t.inject({
      method: 'POST',
      url: '/v1/payment-sessions',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: { amount, currency: 'USDC' },
    })
  }

  it.each<[MerchantTier, string, string]>([
    ['free', '0', '100000000'],
    ['starter', '500000', '99500000'],
    ['growth', '400000', '99600000'],
  ])('charges a %s merchant its plan fee', async (tier, feeAmount, netAmount) => {
    const res = await createSession(tier, '100000000')

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ feeAmount, netAmount })
  })

  it('charges an Enterprise merchant the fee the registry holds', async () => {
    registryFeeBps = 25

    const res = await createSession('enterprise', '100000000')

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ feeAmount: '250000', netAmount: '99750000' })
  })

  it('fails loudly for an Enterprise merchant when the registry cannot be read', async () => {
    const res = await createSession('enterprise', '100000000')

    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body).error.code).toBe('chain_unavailable')
    expect(await t.prisma.db.paymentSession.count()).toBe(0)
  })

  it('prices an invoice at the plan fee', async () => {
    const m = await seedMerchant(t.prisma.db, {
      tier: 'starter',
      onboardingCompleted: true,
      walletAddress: WALLET,
      onchainMerchantId: 1,
    })
    const k = await seedApiKey(t.prisma.db, m.id)

    const res = await t.inject({
      method: 'POST',
      url: '/v1/invoices',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        currency: 'USDC',
        customerEmail: 'buyer@x.test',
        lineItems: [{ description: 'Hosting', quantity: 1, unitAmount: '100000000' }],
        dueInDays: 14,
      },
    })

    expect(res.statusCode).toBe(201)
    const session = await t.prisma.db.paymentSession.findUniqueOrThrow({
      where: { id: JSON.parse(res.body).sessionId },
    })
    expect(session).toMatchObject({ feeAmount: '500000', netAmount: '99500000' })
  })
})
