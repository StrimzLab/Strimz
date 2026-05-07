import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator.js'
import { PrivyAuthGuard } from '../../common/guards/privy.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { StorefrontsService } from './storefronts.service.js'
import { CreateStorefrontDto, CreateStorefrontProductDto } from './storefronts.dto.js'

@ApiTags('storefronts')
@Controller()
export class StorefrontsController {
  constructor(private readonly storefronts: StorefrontsService) {}

  // ----- Authed merchant-side -----

  @ApiBearerAuth()
  @UseGuards(PrivyAuthGuard)
  @Get('/v1/storefront')
  @ApiOperation({ summary: 'Retrieve the merchant’s own storefront.' })
  retrieve(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.storefronts.retrieve(ctx.merchantId)
  }

  @ApiBearerAuth()
  @UseGuards(PrivyAuthGuard)
  @Post('/v1/storefront')
  @ApiOperation({ summary: 'Create or update the merchant storefront.' })
  upsert(@CurrentMerchant() ctx: CurrentMerchantPayload, @Body() dto: CreateStorefrontDto) {
    return this.storefronts.upsert(ctx.merchantId, dto)
  }

  @ApiBearerAuth()
  @UseGuards(PrivyAuthGuard)
  @Post('/v1/storefront/publish')
  publish(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.storefronts.setStatus(ctx.merchantId, 'published')
  }

  @ApiBearerAuth()
  @UseGuards(PrivyAuthGuard)
  @Post('/v1/storefront/archive')
  archive(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.storefronts.setStatus(ctx.merchantId, 'archived')
  }

  @ApiBearerAuth()
  @UseGuards(PrivyAuthGuard)
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
  @UseGuards(PrivyAuthGuard)
  @Post('/v1/storefront/products')
  createProduct(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Body() dto: CreateStorefrontProductDto,
  ) {
    return this.storefronts.createProduct(ctx.merchantId, dto)
  }

  @ApiBearerAuth()
  @UseGuards(PrivyAuthGuard)
  @Get('/v1/storefront/products/:id')
  retrieveProduct(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.storefronts.retrieveProduct(ctx.merchantId, id)
  }

  @ApiBearerAuth()
  @UseGuards(PrivyAuthGuard)
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
}
