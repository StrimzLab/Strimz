import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { ReadinessService, type Readiness } from './readiness.service.js'

@Controller()
export class HealthController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get('/healthz')
  healthz(): { status: 'ok' } {
    return { status: 'ok' }
  }

  @Get('/readyz')
  async readyz(): Promise<{ status: 'ready'; checks: Readiness['checks'] }> {
    const { ready, checks } = await this.readiness.check()
    if (!ready) {
      throw new ServiceUnavailableException({ status: 'unavailable', checks })
    }
    return { status: 'ready', checks }
  }
}
