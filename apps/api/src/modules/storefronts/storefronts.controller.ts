import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator.js'
import { MerchantAuthGuard } from '../../common/guards/merchant-auth.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { StorefrontsService } from './storefronts.service.js'
import {
  CreateStorefrontDto,
  CreateStorefrontProductDto,
  StorefrontCheckoutDto,
} from './storefronts.dto.js'

@ApiTags('storefronts')
@Controller()
export class StorefrontsController {
  constructor(private readonly storefronts: StorefrontsService) {}

  // ----- Authed merchant-side -----

  @ApiBearerAuth()
  @UseGuards(MerchantAuthGuard)
  @Get('/v1/storefront')
  @ApiOperation({ summary: 'Retrieve the merchant’s own storefront.' })
  retrieve(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.storefronts.retrieve(ctx.merchantId)
  }

  @ApiBearerAuth()
  @UseGuards(MerchantAuthGuard)
  @Post('/v1/storefront')
  @ApiOperation({ summary: 'Create or update the merchant storefront.' })
  upsert(@CurrentMerchant() ctx: CurrentMerchantPayload, @Body() dto: CreateStorefrontDto) {
    return this.storefronts.upsert(ctx.merchantId, dto)
  }

  @ApiBearerAuth()
  @UseGuards(MerchantAuthGuard)
  @Post('/v1/storefront/publish')
  publish(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.storefronts.setStatus(ctx.merchantId, 'published')
  }

  @ApiBearerAuth()
  @UseGuards(MerchantAuthGuard)
  @Post('/v1/storefront/archive')
  archive(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.storefronts.setStatus(ctx.merchantId, 'archived')
  }

  @ApiBearerAuth()
  @UseGuards(MerchantAuthGuard)
  @Get('/v1/storefront/products')
  listProducts(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.storefronts.listProducts(ctx.merchantId, {
      limit: limit ? Number(limit) : undefined,
      cursor: cursor ?? null,
    })
  }

  @ApiBearerAuth()
  @UseGuards(MerchantAuthGuard)
  @Post('/v1/storefront/products')
  createProduct(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Body() dto: CreateStorefrontProductDto,
  ) {
    return this.storefronts.createProduct(ctx.merchantId, dto)
  }

  @ApiBearerAuth()
  @UseGuards(MerchantAuthGuard)
  @Get('/v1/storefront/products/:id')
  retrieveProduct(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.storefronts.retrieveProduct(ctx.merchantId, id)
  }

  @ApiBearerAuth()
  @UseGuards(MerchantAuthGuard)
  @Post('/v1/storefront/products/:id/archive')
  archiveProduct(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.storefronts.archiveProduct(ctx.merchantId, id)
  }

  // ----- Public read by slug (hosted storefront page) -----

  @Public()
  @Get('/store/:slug')
  @ApiOperation({ summary: 'Public storefront page by slug. Used by apps/web.' })
  retrievePublic(@Param('slug') slug: string) {
    return this.storefronts.retrievePublic(slug)
  }

  /**
   * Public "Buy" endpoint used by the hosted storefront pages. The
   * customer clicks a product, we mint a payment session (one-time)
   * or resolve the linked subscription plan (recurring), and hand the
   * frontend back the checkout URL. No auth: the storefront's slug +
   * `published` status IS the authorisation model.
   */
  @Public()
  @Post('/store/:slug/products/:productId/checkout')
  @ApiOperation({
    summary:
      'Mint a checkout URL for a storefront product. Called by the public /store/[slug]/products/[id] page when the shopper clicks Buy.',
  })
  checkoutFromProduct(
    @Param('slug') slug: string,
    @Param('productId') productId: string,
    @Body() dto: StorefrontCheckoutDto,
  ) {
    return this.storefronts.checkoutFromProduct(slug, productId, dto)
  }
}
