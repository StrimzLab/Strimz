import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  CreateStorefrontInput,
  CreateStorefrontProductInput,
  Storefront,
  StorefrontProduct,
} from '@strimz/shared-types'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class StorefrontsService {
  constructor(private readonly prisma: PrismaService) {}

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
