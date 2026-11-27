import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CHECKOUT = join(__dirname, '..', '..', '..', '..', 'apps', 'checkout')

interface WorkerConfig {
  name: string
  vars?: Record<string, string>
  services?: { binding: string; service: string }[]
  env?: Record<string, WorkerConfig>
}

function readConfig(): WorkerConfig {
  const raw = readFileSync(join(CHECKOUT, 'wrangler.jsonc'), 'utf8')
  const json = raw.replace(/^\s*\/\/.*$/gmu, '').replace(/,(\s*[}\]])/gu, '$1')
  return JSON.parse(json) as WorkerConfig
}

describe('checkout has a test Worker for Arc testnet', () => {
  it('the test environment deploys as strimz-checkout-test', () => {
    expect(readConfig().env?.test?.name).toBe('strimz-checkout-test')
  })

  it('each Worker references itself, not the other', () => {
    const config = readConfig()
    const self = (c?: WorkerConfig) =>
      c?.services?.find((s) => s.binding === 'WORKER_SELF_REFERENCE')?.service
    expect(self(config)).toBe('strimz-checkout')
    expect(self(config.env?.test)).toBe('strimz-checkout-test')
  })

  it('a script deploys the test Worker', () => {
    const pkg = JSON.parse(readFileSync(join(CHECKOUT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts['deploy:cloudflare:test']).toBe(
      'opennextjs-cloudflare build && opennextjs-cloudflare deploy --env test',
    )
  })
})
