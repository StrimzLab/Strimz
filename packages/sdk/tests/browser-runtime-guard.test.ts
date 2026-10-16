import { afterEach, describe, expect, it, vi } from 'vitest'
import { StrimzAuthenticationError, StrimzBrowserClient, StrimzClient } from '../src/index.js'

const SECRET_TEST = 'sk_test_' + 'a'.repeat(20)
const SECRET_LIVE = 'sk_live_' + 'a'.repeat(20)
const PUBLISHABLE = 'pk_test_' + 'a'.repeat(20)

type Globals = Record<string, unknown>

function construct(globals: Globals, build: () => unknown): unknown {
  for (const [name, value] of Object.entries(globals)) vi.stubGlobal(name, value)
  try {
    build()
    return undefined
  } catch (err) {
    return err
  } finally {
    vi.unstubAllGlobals()
  }
}

const browserMainThread: Globals = {
  process: undefined,
  window: {},
  document: {},
  navigator: { userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/129.0 Safari/537.36' },
}

class FakeWorkerGlobalScope {}

const webWorker: Globals = {
  process: undefined,
  WorkerGlobalScope: FakeWorkerGlobalScope,
  self: new FakeWorkerGlobalScope(),
  navigator: { userAgent: 'Mozilla/5.0 Chrome/129.0' },
}

const reactNative: Globals = {
  process: undefined,
  navigator: { product: 'ReactNative' },
}

const electronRenderer: Globals = {
  window: {},
  document: {},
  navigator: { userAgent: 'Mozilla/5.0 Electron/32.0.0' },
  process: { versions: { node: '20.18.0', electron: '32.0.0' }, type: 'renderer' },
}

const nodeWithDomShim: Globals = {
  window: {},
  document: {},
  navigator: { userAgent: 'Mozilla/5.0 (linux) AppleWebKit/537.36 jsdom/25.0.1' },
}

const deno: Globals = {
  process: undefined,
  Deno: { version: { deno: '2.0.0' } },
  navigator: { userAgent: 'Deno/2.0.0' },
}

const cloudflareWorker: Globals = {
  process: undefined,
  navigator: { userAgent: 'Cloudflare-Workers' },
}

const vercelEdge: Globals = {
  process: undefined,
  EdgeRuntime: 'edge-runtime',
  navigator: { userAgent: 'Mozilla/5.0' },
}

describe('StrimzClient refuses a secret key in a browser runtime', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ['a browser main thread', browserMainThread],
    ['a web worker', webWorker],
    ['React Native', reactNative],
    ['an Electron renderer', electronRenderer],
  ])('throws secret_key_in_browser in %s', (_label, globals) => {
    for (const key of [SECRET_TEST, SECRET_LIVE]) {
      const err = construct(globals, () => new StrimzClient({ apiKey: key }))
      expect(err).toBeInstanceOf(StrimzAuthenticationError)
      expect((err as StrimzAuthenticationError).code).toBe('secret_key_in_browser')
      expect((err as StrimzAuthenticationError).httpStatus).toBeUndefined()
      expect((err as Error).message).toContain('server')
      expect((err as Error).message).not.toContain(key)
    }
  })

  it.each([
    ['Node with a DOM shim such as jsdom', nodeWithDomShim],
    ['Deno', deno],
    ['Cloudflare Workers', cloudflareWorker],
    ['Vercel Edge', vercelEdge],
  ])('accepts a secret key in %s', (_label, globals) => {
    const err = construct(globals, () => new StrimzClient({ apiKey: SECRET_TEST }))
    expect(err).toBeUndefined()
  })

  it('accepts a secret key in plain Node', () => {
    expect(new StrimzClient({ apiKey: SECRET_TEST }).mode).toBe('test')
  })

  it('still lets StrimzBrowserClient take a publishable key in a browser', () => {
    const err = construct(
      browserMainThread,
      () => new StrimzBrowserClient({ publishableKey: PUBLISHABLE }),
    )
    expect(err).toBeUndefined()
  })
})
