import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  CreateStorefrontInput,
  CreateStorefrontProductInput,
  Storefront,
  StorefrontCheckoutInput,
  StorefrontCheckoutResponse,
  StorefrontProduct,
} from '@strimz/shared-types'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { TypedConfigService } from '../../config/index.js'
import { PaymentSessionsService } from '../payment-sessions/payment-sessions.service.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class StorefrontsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentSessions: PaymentSessionsService,
    private readonly cfg: TypedConfigService,
  ) {}

  async retrieve(merchantId: string): Promise<Storefront | null> {
    const row = await this.prisma.db.storefront.findUnique({ where: { merchantId } })
    return row ? serialise(row) : null
  }

  async upsert(merchantId: string, input: CreateStorefrontInput): Promise<Storefront> {
    const existing = await this.prisma.db.storefront.findFirst({
      where: { slug: input.slug, NOT: { merchantId } },
    })
    if (existing) {
      throw new ConflictException({
        code: 'invalid_request',
        message: 'slug is taken by another merchant',
      })
    }
    const row = await this.prisma.db.storefront.upsert({
      where: { merchantId },
      create: {
        merchantId,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        logoUrl: input.logoUrl ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        accentColor: input.accentColor ?? null,
        socialLinks: (input.socialLinks ?? []) as never,
      },
      update: {
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        logoUrl: input.logoUrl ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        accentColor: input.accentColor ?? null,
        socialLinks: (input.socialLinks ?? []) as never,
      },
    })
    return serialise(row)
  }

  async setStatus(merchantId: string, status: 'published' | 'archived'): Promise<Storefront> {
    const existing = await this.prisma.db.storefront.findUnique({ where: { merchantId } })
    if (!existing) {
      throw new NotFoundException({ code: 'not_found', message: 'storefront not yet created' })
    }
    const row = await this.prisma.db.storefront.update({
      where: { merchantId },
      data: { status },
    })
    return serialise(row)
  }

  // ----- Products -----

  async listProducts(merchantId: string, params: { limit?: number; cursor?: string | null }) {
    const sf = await this.prisma.db.storefront.findUnique({ where: { merchantId } })
    if (!sf) {
      throw new NotFoundException({ code: 'not_found', message: 'storefront not yet created' })
    }
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.storefrontProduct.findMany({
      where: { storefrontId: sf.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialiseProduct)
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore }
  }

  async createProduct(
    merchantId: string,
    input: CreateStorefrontProductInput,
  ): Promise<StorefrontProduct> {
    const sf = await this.prisma.db.storefront.findUnique({ where: { merchantId } })
    if (!sf) {
      throw new NotFoundException({ code: 'not_found', message: 'storefront not yet created' })
    }
    const row = await this.prisma.db.storefrontProduct.create({
      data: {
        storefrontId: sf.id,
        name: input.name,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        price: input.price,
        currency: input.currency,
        type: input.type,
        interval: input.interval ?? null,
        intervalCount: input.intervalCount ?? null,
        stock: input.stock ?? null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    })
    return serialiseProduct(row)
  }

  async retrieveProduct(merchantId: string, id: string): Promise<StorefrontProduct> {
    const row = await this.prisma.db.storefrontProduct.findFirst({
      where: { id, storefront: { merchantId } },
    })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'product not found' })
    return serialiseProduct(row)
  }

  async archiveProduct(merchantId: string, id: string): Promise<StorefrontProduct> {
    const row = await this.prisma.db.storefrontProduct.findFirst({
      where: { id, storefront: { merchantId } },
    })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'product not found' })
    const updated = await this.prisma.db.storefrontProduct.update({
      where: { id: row.id },
      data: { isActive: false },
    })
    return serialiseProduct(updated)
  }

  /** Public read (by slug) — used by the hosted storefront page in apps/web. */
  async retrievePublic(slug: string): Promise<{
    storefront: Storefront
    products: StorefrontProduct[]
  }> {
    const sf = await this.prisma.db.storefront.findUnique({ where: { slug } })
    if (!sf || sf.status !== 'published') {
      throw new NotFoundException({ code: 'not_found', message: 'storefront not found' })
    }
    const products = await this.prisma.db.storefrontProduct.findMany({
      where: { storefrontId: sf.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    return { storefront: serialise(sf), products: products.map(serialiseProduct) }
  }

  /**
   * Public "Buy" endpoint. Called from `/store/[slug]/products/[id]`
   * when a shopper clicks Buy.
   *
   * Behaviour:
   *   - one_time: mint a fresh PaymentSession scoped to the merchant
   *     that owns this storefront. The session inherits the product's
   *     name (description), amount, and currency. Stock is decremented
   *     if the product has a finite stock; unlimited-stock products
   *     (`stock === null`) skip the check. The API key mode is `live`
   *     — every published product goes through the real relay.
   *   - subscription: hand back the plan's hosted-checkout URL
   *     (`/sub/{planId}`). The product must have a linked planId,
   *     which the merchant creates via /v1/storefront/products from
   *     the dashboard.
   */
  async checkoutFromProduct(
    slug: string,
    productId: string,
    input: StorefrontCheckoutInput,
  ): Promise<StorefrontCheckoutResponse> {
    const sf = await this.prisma.db.storefront.findUnique({ where: { slug } })
    if (!sf || sf.status !== 'published') {
      throw new NotFoundException({ code: 'not_found', message: 'storefront not found' })
    }

    const product = await this.prisma.db.storefrontProduct.findFirst({
      where: { id: productId, storefrontId: sf.id, isActive: true },
    })
    if (!product) {
      throw new NotFoundException({ code: 'not_found', message: 'product not found' })
    }
    if (product.stock !== null && product.stock <= 0) {
      throw new ConflictException({
        code: 'invalid_request',
        message: 'product is sold out',
      })
    }

    const checkoutOrigin = this.cfg.env.CHECKOUT_ORIGIN
    const returnPath = input.returnPath?.startsWith('/') ? input.returnPath : '/'
    const merchantReturn = `${checkoutOrigin}/store/${sf.slug}${returnPath === '/' ? '' : returnPath}`

    if (product.type === 'subscription') {
      if (!product.planId) {
        throw new BadRequestException({
          code: 'invalid_request',
          message:
            'this product is a subscription but has no linked plan — the merchant needs to attach one first',
        })
      }
      return {
        checkoutUrl: `${checkoutOrigin}/sub/${product.planId}`,
        ref: product.planId,
        kind: 'subscription_plan',
      }
    }

    const session = await this.paymentSessions.create(sf.merchantId, 'live', {
      currency: product.currency as 'USDC' | 'EURC',
      amount: product.price,
      description: product.name,
      expiresInMinutes: 30,
      successUrl: `${merchantReturn}?checkout=success`,
      cancelUrl: `${merchantReturn}?checkout=cancelled`,
      metadata: {
        source: 'storefront',
        storefrontSlug: sf.slug,
        productId: product.id,
        productName: product.name,
        ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}),
      },
      ...(input.customerEmail ? { customer: { email: input.customerEmail } } : {}),
    })

    if (product.stock !== null) {
      // Decrement stock atomically. Race-safe under concurrent buys —
      // `stock: { decrement: 1 }` translates to `UPDATE ... SET stock =
      // stock - 1`, not a check-then-write. The sold-out gate above
      // handles the visible case; concurrent buys of the last unit will
      // result in one row landing at -1 rather than a conflict, and the
      // scheduler's fulfilment cron treats <=0 as sold-out on the next
      // tick. Merchants can always top the stock back up.
      await this.prisma.db.storefrontProduct.update({
        where: { id: product.id },
        data: { stock: { decrement: 1 } },
      })
    }

    return {
      checkoutUrl: `${checkoutOrigin}/pay/${session.id}`,
      ref: session.id,
      kind: 'payment_session',
    }
  }
}

function serialise(row: any): Storefront {
  return {
    id: row.id,
    merchantId: row.merchantId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    logoUrl: row.logoUrl,
    coverImageUrl: row.coverImageUrl,
    accentColor: row.accentColor,
    socialLinks: row.socialLinks,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serialiseProduct(row: any): StorefrontProduct {
  return {
    id: row.id,
    storefrontId: row.storefrontId,
    name: row.name,
    description: row.description,
    imageUrl: row.imageUrl,
    price: row.price,
    currency: row.currency,
    type: row.type,
    interval: row.interval,
    intervalCount: row.intervalCount,
    stock: row.stock,
    planId: row.planId,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } as StorefrontProduct
}
