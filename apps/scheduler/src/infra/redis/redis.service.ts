import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import { Redis } from 'ioredis'
import { TypedConfigService } from '../../config/index.js'

@Injectable()
export class RedisService implements OnModuleDestroy {
  public readonly client: Redis
  private readonly log = new Logger(RedisService.name)

  constructor(cfg: TypedConfigService) {
    this.client = new Redis(cfg.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    })
    this.client.on('error', (err) => this.log.error(`redis error: ${err.message}`))
    this.client.on('connect', () => this.log.log('redis connected'))
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit()
  }
}
