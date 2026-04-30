import { Module } from '@nestjs/common'
import { AgentActionWorker } from './agent-action.worker.js'

@Module({ providers: [AgentActionWorker] })
export class AgentActionModule {}
