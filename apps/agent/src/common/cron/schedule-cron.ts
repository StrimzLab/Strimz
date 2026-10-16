import type { Logger } from '@nestjs/common'
import type { SchedulerRegistry } from '@nestjs/schedule'
import { CronJob } from 'cron'

export function scheduleCron(
  registry: SchedulerRegistry,
  name: string,
  cronTime: string,
  tick: () => Promise<void>,
  log: Logger,
): void {
  const job = CronJob.from({
    cronTime,
    onTick: () => {
      tick().catch((err: unknown) => {
        log.error(`${name} tick failed`, err instanceof Error ? err.stack : String(err))
      })
    },
    start: false,
  })
  registry.addCronJob(name, job)
  job.start()
}
