import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import type { Hex } from 'viem'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'
import { makePrivyDid } from '../helpers/stubs/privy.stub.js'

const ADMIN_EMAIL = 'ops@strimz.test'
const adminToken = `test|${makePrivyDid(ADMIN_EMAIL)}|${ADMIN_EMAIL}|`
const WALLET = '0x00000000000000000000000000000000000000c1'
const ZERO = '0x0000000000000000000000000000000000000000'

interface RegistryRecord {
  feeBps: number
  maxFeeBps: number
}

type ReadArgs = { address: Hex; functionName: string; args?: readonly unknown[] }
type ChainClient = { readContract: (args: ReadArgs) => Promise<unknown> }

describe('merchant tier control', () => {
  let t: TestApp
  let client: ChainClient
  let originalRead: ChainClient['readContract']
  let registry: Map<bigint, RegistryRecord>
  let registryDown: boolean

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
    registry = new Map()
    registryDown = false
    client.readContract = (args) => {
      if (args.functionName !== 'getMerchant') return originalRead(args)
      if (registryDown) return Promise.reject(new Error('rpc unavailable'))
      const id = args.args?.[0] as bigint
      const record = registry.get(id)
      if (!record) return Promise.reject(new Error(`Registry__UnknownMerchant(${id})`))
      return Promise.resolve({
        owner: WALLET,
        feeBps: record.feeBps,
        active: true,
        payoutAddress: '0x000000000000000000000000000000000000beef',
        parentMerchantId: 0n,
        pendingOwner: ZERO,
        pendingPayoutAddress: ZERO,
        payoutChangeCommitAt: 0n,
        maxFeeBps: record.maxFeeBps,
      })
    }
  })
  afterEach(() => {
    client.readContract = originalRead
  })

  const errorOf = (body: string) =>
    (JSON.parse(body) as { error: { code: string; details?: Record<string, unknown> } }).error

  const tierOf = async (id: string) =>
    (await t.prisma.db.merchant.findUniqueOrThrow({ where: { id }, select: { tier: true } })).tier

  const seedAdmin = () =>
    t.prisma.db.adminUser.create({
      data: { email: ADMIN_EMAIL, role: 'admin', privyUserId: makePrivyDid(ADMIN_EMAIL) },
    })

  const adminSetTier = (merchantId: string, tier: string) =>
    t.inject({
      method: 'PATCH',
      url: `/v1/admin/merchants/${merchantId}/tier`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { tier },
    })

  describe('a merchant cannot choose its own tier', () => {
    it('has no self-serve tier route and leaves the tier at free', async () => {
      const m = await seedMerchant(t.prisma.db)
      const res = await t.inject({
        method: 'POST',
        url: '/v1/merchants/me/tier',
        headers: { authorization: `Bearer ${m.privyAccessToken}` },
        payload: { tier: 'growth' },
      })
      expect(res.statusCode).toBe(404)
      expect(await tierOf(m.id)).toBe('free')
    })

    it('cannot raise its own daily relay quota by picking a tier', async () => {
      const m = await seedMerchant(t.prisma.db)
      await t.inject({
        method: 'POST',
        url: '/v1/merchants/me/tier',
        headers: { authorization: `Bearer ${m.privyAccessToken}` },
        payload: { tier: 'enterprise' },
      })
      expect(await tierOf(m.id)).toBe('free')
    })
  })

  describe('an admin sets Enterprise only', () => {
    it.each(['free', 'starter', 'growth'])(
      'refuses to set %s by hand because it follows volume',
      async (tier) => {
        await seedAdmin()
        const m = await seedMerchant(t.prisma.db, {
          onboardingCompleted: true,
          walletAddress: WALLET,
          onchainMerchantId: 7,
        })
        registry.set(7n, { feeBps: 0, maxFeeBps: 50 })

        const res = await adminSetTier(m.id, tier)

        expect(res.statusCode).toBe(400)
        expect(errorOf(res.body).code).toBe('invalid_request')
        expect(await tierOf(m.id)).toBe('free')
      },
    )

    it('moves a registered merchant to Enterprise and audits the registry fee', async () => {
      const admin = await seedAdmin()
      const m = await seedMerchant(t.prisma.db, {
        tier: 'growth',
        onboardingCompleted: true,
        walletAddress: WALLET,
        onchainMerchantId: 9,
      })
      registry.set(9n, { feeBps: 25, maxFeeBps: 50 })

      const res = await adminSetTier(m.id, 'enterprise')

      expect(res.statusCode).toBe(200)
      expect(await tierOf(m.id)).toBe('enterprise')
      const audit = await t.prisma.db.auditLog.findFirstOrThrow({
        where: { actorId: admin.id, action: 'merchant.tier_changed', targetId: m.id },
      })
      expect(audit.metadata).toMatchObject({
        previous: 'growth',
        next: 'enterprise',
        onchainMerchantId: '9',
        onchainFeeBps: 25,
      })
    })

    it('refuses Enterprise for a merchant that is not registered on-chain', async () => {
      await seedAdmin()
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true })

      const res = await adminSetTier(m.id, 'enterprise')

      expect(res.statusCode).toBe(409)
      expect(errorOf(res.body).code).toBe('merchant_not_registered')
      expect(await tierOf(m.id)).toBe('free')
    })

    it('fails loudly and changes nothing when the registry cannot be read', async () => {
      await seedAdmin()
      const m = await seedMerchant(t.prisma.db, {
        onboardingCompleted: true,
        walletAddress: WALLET,
        onchainMerchantId: 10,
      })
      registryDown = true

      const res = await adminSetTier(m.id, 'enterprise')

      expect(res.statusCode).toBe(503)
      expect(errorOf(res.body).code).toBe('chain_unavailable')
      expect(await tierOf(m.id)).toBe('free')
    })
  })
})
