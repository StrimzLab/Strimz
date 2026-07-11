import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { TokenMetadata, TokenPermitNonce } from '@strimz/shared-types'

import { Public } from '../../common/decorators/public.decorator.js'
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js'
import { TokensService } from './tokens.service.js'

/**
 * Public token metadata endpoints.
 *
 * No authentication: the data is purely chain-derived, has no PII,
 * and is the same chain reads any client could do directly with a
 * public RPC. We host these endpoints so the browser SDK doesn't
 * need to ship a chain client + RPC URL.
 *
 *   GET /v1/tokens/:address              token metadata + capabilities
 *   GET /v1/tokens/:address/permit-nonce permit nonce for an owner
 *
 * Both endpoints throw `404 token_not_whitelisted` if the token is
 * not in Strimz's TokenWhitelist — we deliberately don't expose
 * metadata for tokens we haven't accepted, because doing so would
 * make the SDK look like a generic token-info API instead of an
 * allowlist-gated payments surface.
 */
@ApiTags('tokens')
@Controller('/v1/tokens')
export class TokensController {
  constructor(private readonly tokens: TokensService) {}

  @ApiOperation({
    summary: 'Get token metadata and Strimz capabilities',
    description:
      'Returns name, symbol, decimals, EIP-712 domain version, and capability ' +
      'bitmap (EIP-2612 permit, EIP-3009 transferWithAuthorization). The browser ' +
      'SDK uses this to pick which meta-tx path to take for a given token.',
  })
  @Public()
  @Get('/:address')
  async getMetadata(@Param('address') addressParam: string): Promise<TokenMetadata> {
    return this.tokens.getMetadata(parseAddress(addressParam))
  }

  @ApiOperation({
    summary: "Get an owner's EIP-2612 permit nonce",
    description:
      'Returns the current `nonces(owner)` value for the token. Read this ' +
      'immediately before signing a Permit — the token contract rejects stale ' +
      'nonces.',
  })
  @Public()
  // Chain reads over RPC are free but not costless — bound scraper
  // traffic against Strimz's RPC quota. Real checkout flows read this
  // once per subscription enrolment; 30/hr per IP is far above that.
  @RateLimit({ max: 30, windowMs: 60 * 60 * 1000, keyBy: 'ip', label: 'tokens.permitNonce' })
  @Get('/:address/permit-nonce')
  async getPermitNonce(
    @Param('address') addressParam: string,
    @Query('owner') ownerParam?: string,
  ): Promise<TokenPermitNonce> {
    if (!ownerParam) {
      throw new BadRequestException({
        code: 'missing_owner',
        message: 'owner query parameter is required',
      })
    }
    return this.tokens.getPermitNonce(parseAddress(addressParam), parseAddress(ownerParam))
  }
}

function parseAddress(raw: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{40}$/u.test(raw)) {
    throw new BadRequestException({
      code: 'invalid_address',
      message: `expected a 0x-prefixed 20-byte address, got ${raw}`,
    })
  }
  return raw.toLowerCase() as `0x${string}`
}
