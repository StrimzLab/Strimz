import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { TypedConfigService } from '../../config/index.js'
import { QUEUE_NAMES } from './queue-names.js'

/**
 * Wires up BullMQ with the shared Redis URL. Per-feature modules
 * register their own queues with `BullModule.registerQueue()`.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [TypedConfigService],
      useFactory: (cfg: TypedConfigService) => {
        const url = new URL(cfg.env.REDIS_URL)
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || '6379'),
            password: url.password || undefined,
            username: url.username || undefined,
            db: url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : 0,
            maxRetriesPerRequest: null,
          },
        }
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.routingCctpBridge },
      { name: QUEUE_NAMES.agentAction },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
