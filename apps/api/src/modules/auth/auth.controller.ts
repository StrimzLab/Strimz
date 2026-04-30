import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { Public } from '../../common/decorators/public.decorator.js'
import { CurrentMerchant, type CurrentMerchantPayload } from '../../common/decorators/current-merchant.decorator.js'
import { PrivyAuthGuard } from '../../common/guards/privy.guard.js'
import { AuthService, type SyncResult } from './auth.service.js'
import { MerchantsService } from '../merchants/merchants.service.js'

class TurnstileVerifyDto extends createZodDto(
  z.object({ token: z.string().min(1, 'token is required') }),
) {}

class SyncDto extends createZodDto(
  z.object({ accessToken: z.string().min(1, 'accessToken is required') }),
) {}

@ApiTags('auth')
@Controller('/v1/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly merchants: MerchantsService,
  ) {}

  @Public()
  @Post('/turnstile/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a Cloudflare Turnstile token before opening Privy.' })
  verifyTurnstile(@Body() dto: TurnstileVerifyDto, @Ip() ip: string) {
    return this.auth.verifyTurnstile(dto.token, ip)
  }

  @Public()
  @Post('/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Verify a Privy access token, upsert the Merchant row, and return the synced profile. Idempotent.',
  })
  sync(@Body() dto: SyncDto): Promise<SyncResult> {
    return this.auth.sync(dto.accessToken)
  }

  @ApiBearerAuth()
  @UseGuards(PrivyAuthGuard)
  @Get('/me')
  @ApiOperation({ summary: 'Return the merchant attached to the current session.' })
  me(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.merchants.findById(ctx.merchantId)
  }
}
