import { Logger } from '@nestjs/common'
import type * as BullMq from 'bullmq'
import { afterEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map<string, (...args: unknown[]) => void>()

vi.mock('bullmq', async (importOriginal) => ({
  ...(await importOriginal<typeof BullMq>()),
  Worker: class {
    on(event: string, handler: (...args: unknown[]) => void) {
      handlers.set(event, handler)
      return this
    }
    close() {
      return Promise.resolve()
    }
  },
}))

const { RelayProcessor } = await import('../../../../src/modules/relay/relay.processor.js')

describe('RelayProcessor', () => {
  afterEach(() => {
    handlers.clear()
    vi.restoreAllMocks()
  })

  it('logs worker errors, such as a lost Redis connection', () => {
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const processor = new RelayProcessor({ client: {} } as never, {} as never)
    processor.onModuleInit()

    const onError = handlers.get('error')
    expect(onError).toBeTypeOf('function')
    onError?.(new Error('connect ECONNREFUSED 127.0.0.1:6379'))
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'))
  })
})
