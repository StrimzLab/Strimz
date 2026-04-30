import { Controller, Get } from '@nestjs/common'

@Controller()
export class HealthController {
  @Get('/healthz')
  healthz(): { status: 'ok' } {
    return { status: 'ok' }
  }

  @Get('/readyz')
  readyz(): { status: 'ready' } {
    return { status: 'ready' }
  }
}
