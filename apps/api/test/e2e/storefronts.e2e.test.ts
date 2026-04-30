import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'

describe('storefronts e2e', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
  })

  it('upsert + publish + public read by slug', async () => {
    const m = await seedMerchant(t.prisma.db)

    const upsert = await t.inject({
      method: 'POST',
      url: '/v1/storefront',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
      payload: {
        slug: 'acme-shop',
        name: 'Acme Shop',
        description: 'Quality widgets.',
        logoUrl: null,
        coverImageUrl: null,
        accentColor: null,
        socialLinks: [],
      },
    })
    expect(upsert.statusCode).toBe(201)

    // Storefront defaults to draft; public read should 404.
    const draftRead = await t.inject({ method: 'GET', url: '/store/acme-shop' })
    expect(draftRead.statusCode).toBe(404)

    const pub = await t.inject({
      method: 'POST',
      url: '/v1/storefront/publish',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
      payload: {},
    })
    expect(pub.statusCode).toBe(201)

    const publicRead = await t.inject({ method: 'GET', url: '/store/acme-shop' })
    expect(publicRead.statusCode).toBe(200)
    expect(JSON.parse(publicRead.body).storefront.name).toBe('Acme Shop')
  })

  it('rejects a slug that another merchant owns', async () => {
    const m1 = await seedMerchant(t.prisma.db)
    const m2 = await seedMerchant(t.prisma.db)
    const baseSf = {
      description: null,
      logoUrl: null,
      coverImageUrl: null,
      accentColor: null,
      socialLinks: [],
    }
    await t.inject({
      method: 'POST',
      url: '/v1/storefront',
      headers: { authorization: `Bearer ${m1.privyAccessToken}` },
      payload: { slug: 'taken', name: 'M1 Shop', ...baseSf },
    })
    const r = await t.inject({
      method: 'POST',
      url: '/v1/storefront',
      headers: { authorization: `Bearer ${m2.privyAccessToken}` },
      payload: { slug: 'taken', name: 'M2 Shop', ...baseSf },
    })
    expect(r.statusCode).toBe(409)
  })

  it('CRUD products on the merchant storefront', async () => {
    const m = await seedMerchant(t.prisma.db)
    await t.inject({
      method: 'POST',
      url: '/v1/storefront',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
      payload: {
        slug: 'svc-shop',
        name: 'Service Shop',
        description: null,
        logoUrl: null,
        coverImageUrl: null,
        accentColor: null,
        socialLinks: [],
      },
    })
    const create = await t.inject({
      method: 'POST',
      url: '/v1/storefront/products',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
      payload: {
        name: 'Widget',
        description: null,
        price: '5000000',
        currency: 'USDC',
        type: 'one_time',
        interval: null,
        intervalCount: null,
        stock: null,
        isActive: true,
      },
    })
    expect(create.statusCode).toBe(201)
    const productId = JSON.parse(create.body).id

    const list = await t.inject({
      method: 'GET',
      url: '/v1/storefront/products',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
    })
    expect(JSON.parse(list.body).data).toHaveLength(1)

    const arch = await t.inject({
      method: 'POST',
      url: `/v1/storefront/products/${productId}/archive`,
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
      payload: {},
    })
    expect(arch.statusCode).toBe(201)
    expect(JSON.parse(arch.body).isActive).toBe(false)
  })
})
