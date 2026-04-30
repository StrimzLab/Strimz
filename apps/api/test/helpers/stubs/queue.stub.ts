/**
 * Recording in-memory queue. Replaces the real BullMQ-backed `QueueService`
 * during tests, captures every `add()` call, and exposes accessors so a spec
 * can assert "X jobs landed on Y queue."
 */
export interface RecordedJob {
  queue: string
  name: string
  data: unknown
  opts: unknown
}

export class StubQueueService {
  public readonly recorded: RecordedJob[] = []

  queue(queueName: string) {
    return {
      add: async (name: string, data: unknown, opts?: unknown) => {
        this.recorded.push({ queue: queueName, name, data, opts })
        return { id: String(this.recorded.length) }
      },
    }
  }

  reset() {
    this.recorded.length = 0
  }

  jobsFor(queueName: string): RecordedJob[] {
    return this.recorded.filter((j) => j.queue === queueName)
  }

  async onModuleDestroy() {
    /* no-op */
  }
}
