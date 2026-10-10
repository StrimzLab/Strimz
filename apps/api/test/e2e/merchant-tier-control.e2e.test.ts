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
        payload: { tier: 'business' },
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

  describe('an admin tier change follows the on-chain fee', () => {
    it('refuses a tier whose fee differs from the registry fee and keeps the old tier', async () => {
      await seedAdmin()
      const m = await seedMerchant(t.prisma.db, {
        onboardingCompleted: true,
        walletAddress: WALLET,
        onchainMerchantId: 7,
      })
      registry.set(7n, { feeBps: 150, maxFeeBps: 150 })

      const res = await adminSetTier(m.id, 'business')

      expect(res.statusCode).toBe(409)
      const error = errorOf(res.body)
      expect(error.code).toBe('onchain_fee_mismatch')
      expect(error.details).toMatchObject({
        onchainMerchantId: '7',
        onchainFeeBps: 150,
        requiredFeeBps: 50,
        maxFeeBps: 150,
      })
      expect(await tierOf(m.id)).toBe('free')
    })

    it('refuses a tier above the merchant ceiling and says so', async () => {
      await seedAdmin()
      const m = await seedMerchant(t.prisma.db, {
        onboardingCompleted: true,
        walletAddress: WALLET,
        onchainMerchantId: 8,
      })
      await t.prisma.db.merchant.update({ where: { id: m.id }, data: { tier: 'business' } })
      registry.set(8n, { feeBps: 50, maxFeeBps: 50 })

      const res = await adminSetTier(m.id, 'free')

      expect(res.statusCode).toBe(409)
      expect(errorOf(res.body).code).toBe('onchain_fee_above_ceiling')
      expect(await tierOf(m.id)).toBe('business')
    })

    it('applies a tier once the registry already charges its fee and audits the fee read', async () => {
      const admin = await seedAdmin()
      const m = await seedMerchant(t.prisma.db, {
        onboardingCompleted: true,
        walletAddress: WALLET,
        onchainMerchantId: 9,
      })
      registry.set(9n, { feeBps: 50, maxFeeBps: 150 })

      const res = await adminSetTier(m.id, 'business')

      expect(res.statusCode).toBe(200)
      expect(await tierOf(m.id)).toBe('business')
      const audit = await t.prisma.db.auditLog.findFirstOrThrow({
        where: { actorId: admin.id, action: 'merchant.tier_changed', targetId: m.id },
      })
      expect(audit.metadata).toMatchObject({
        previous: 'free',
        next: 'business',
        onchainMerchantId: '9',
        onchainFeeBps: 50,
      })
    })

    it('refuses a paid tier for a merchant that is not registered on-chain', async () => {
      await seedAdmin()
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true })

      const res = await adminSetTier(m.id, 'growth')

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

      const res = await adminSetTier(m.id, 'growth')

      expect(res.statusCode).toBe(503)
      expect(errorOf(res.body).code).toBe('chain_unavailable')
      expect(await tierOf(m.id)).toBe('free')
    })
  })
})
