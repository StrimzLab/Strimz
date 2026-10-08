import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { QUEUE_NAMES } from '@strimz/queue-contracts'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

const CHECK_TIMEOUT_MS = 2_000

export type CheckResult = 'ok' | 'error'

export interface Readiness {
  ready: boolean
  checks: { database: CheckResult; redis: CheckResult }
}

@Injectable()
export class ReadinessService {
  private readonly log = new Logger(ReadinessService.name)

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.agentAction)
    private readonly queue: Queue,
  ) {}

  async check(): Promise<Readiness> {
    const [database, redis] = await Promise.all([
      this.probe('database', async () => {
        await this.prisma.db.$queryRawUnsafe('SELECT 1')
      }),
      this.probe('redis', async () => {
        const client = await this.queue.client
        await client.ping()
      }),
    ])
    return { ready: database === 'ok' && redis === 'ok', checks: { database, redis } }
  }

  private async probe(name: string, run: () => Promise<void>): Promise<CheckResult> {
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`no answer within ${CHECK_TIMEOUT_MS}ms`)),
        CHECK_TIMEOUT_MS,
      )
    })
    try {
      await Promise.race([run(), timeout])
      return 'ok'
    } catch (err) {
      this.log.warn(`readiness check ${name} failed: ${(err as Error).message}`)
      return 'error'
    } finally {
      clearTimeout(timer)
    }
  }
}
