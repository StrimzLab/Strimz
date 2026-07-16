import { Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator.js'
import { ContactService } from './contact.service.js'
import { ContactRequestDto } from './contact.dto.js'

@ApiTags('contact')
@Controller('v1/contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Public()
  @Post()
  @ApiOperation({
    summary:
      'Deliver a marketing-form message to the Strimz support inbox. Backs the /contact page on the marketing site.',
  })
  submit(@Body() dto: ContactRequestDto) {
    return this.contact.submit(dto)
  }
}
