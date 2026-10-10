import { Body, Controller, ForbiddenException, Ip, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator.js'
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js'
import { TurnstileService } from '../../infra/turnstile/turnstile.service.js'
import { ContactService } from './contact.service.js'
import { ContactRequestDto } from './contact.dto.js'

@ApiTags('contact')
@Controller('v1/contact')
export class ContactController {
  constructor(
    private readonly contact: ContactService,
    private readonly turnstile: TurnstileService,
  ) {}

  @Public()
  @RateLimit({ max: 5, windowMs: 60 * 60 * 1000, keyBy: 'ip', label: 'contact.submit' })
  @Post()
  @ApiOperation({
    summary:
      'Deliver a marketing-form message to the Strimz support inbox. Backs the /contact page on the marketing site.',
  })
  async submit(@Body() dto: ContactRequestDto, @Ip() ip: string) {
    const passed = await this.turnstile.verify(dto.turnstileToken, ip, 'contact')
    if (!passed) {
      throw new ForbiddenException({ code: 'bot_check_failed', message: 'bot check failed' })
    }
    return this.contact.submit(dto)
  }
}
