import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_NAMES } from '../../infra/queue/queue-names.js'
import { BridgeWorker } from './bridge.worker.js'

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.routingCctpBridge },
      { name: QUEUE_NAMES.agentAction },
    ),
  ],
  providers: [BridgeWorker],
})
export class RoutingModule {}
