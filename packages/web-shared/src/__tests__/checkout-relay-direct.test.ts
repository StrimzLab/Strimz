import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const SELF = fileURLToPath(import.meta.url)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx|mjs|js)$/u.test(name) && path !== SELF ? [path] : []
  })
}

const FILES = [
  ...sourceFiles(join(WEB_ROOT, 'src')),
  join(WEB_ROOT, 'next.config.mjs'),
  join(WEB_ROOT, '.env.example'),
]

function filesContaining(needle: string): string[] {
  return FILES.filter((file) => readFileSync(file, 'utf8').includes(needle)).map((file) =>
    relative(WEB_ROOT, file),
  )
}

describe('hosted checkout relay', () => {
  it('holds no internal API key', () => {
    expect(filesContaining('STRIMZ_INTERNAL_API_KEY')).toEqual([])
  })

  it('has no checkout BFF route left to call', () => {
    expect(filesContaining('/api/checkout/sessions/${')).toEqual([])
  })

  it('sends both hooks through the public checkout relay client', () => {
    for (const hook of ['use-pay-checkout.ts', 'use-subscription-checkout.ts']) {
      const source = readFileSync(join(WEB_ROOT, 'src/hooks', hook), 'utf8')
      expect(source, hook).toContain('submitCheckoutRelay(')
      expect(source, hook).toContain('checkoutSubmissionUrl(')
    }
  })
})
