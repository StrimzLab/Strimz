import { Controller, Get } from '@nestjs/common'
import { Public } from '../../common/decorators/public.decorator.js'

interface HealthResponse {
  status: 'ok'
  service: 'strimz-api'
  timestamp: string
}

/**
 * Liveness + readiness endpoints.
 *
 * Liveness is a static `200 ok` (the process is up).
 * Readiness will be extended to ping Postgres + Redis once those checks
 * are needed for the deployment platform.
 */
@Controller()
export class HealthController {
  @Public()
  @Get('/health')
  liveness(): HealthResponse {
    return { status: 'ok', service: 'strimz-api', timestamp: new Date().toISOString() }
  }

  @Public()
  @Get('/ready')
  readiness(): HealthResponse {
    return { status: 'ok', service: 'strimz-api', timestamp: new Date().toISOString() }
  }
}
