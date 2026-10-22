import { Socket } from 'node:net'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'

// Redis is stubbed in e2e, so anything dialling a socket on its own is a leak (#351).
describe('test app and Redis', () => {
  const connect = vi.spyOn(Socket.prototype, 'connect')
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
    await new Promise((resolve) => setTimeout(resolve, 1_500))
  })

  afterAll(async () => {
    await t?.close()
    connect.mockRestore()
  })

  it('never opens a connection to Redis', () => {
    // net.connect hands Socket#connect its normalised [options, callback] pair.
    const ports = connect.mock.calls.map(([arg]) => {
      const options: unknown = Array.isArray(arg) ? arg[0] : arg
      return typeof options === 'object' && options !== null && 'port' in options
        ? Number(options.port)
        : Number(options)
    })
    expect(ports).not.toContain(6379)
  })
})
