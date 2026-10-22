import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import { FAQS } from '@/components/marketing/home/faq-data'

const WEB_ROOT = join(__dirname, '..', '..')
const ARC = /\bArc\b/u

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.tsx?$/u.test(name) && !/\.test\.tsx?$/u.test(name) ? [path] : []
  })
}

// Cross-chain payments are coming, so public copy names the outcome, not the network (#349).
// The Terms keep Arc on purpose, and the FAQ says where customers pay today.
const PUBLIC = [
  ...files(join(WEB_ROOT, 'src/components/marketing')),
  ...files(join(WEB_ROOT, 'src/app/(marketing)')).filter((f) => !f.includes('/legal/')),
  join(WEB_ROOT, 'src/app/layout.tsx'),
  join(WEB_ROOT, 'src/lib/seo.ts'),
].filter((f) => !f.endsWith('faq-data.ts'))

describe('public pages do not lead with the network name', () => {
  it('keeps Arc out of marketing pages, the footer and site metadata', () => {
    const hits = PUBLIC.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${relative(WEB_ROOT, file)}:${i + 1}` }))
        .filter(({ line }) => ARC.test(line))
        .map(({ at }) => at),
    )
    expect(hits).toEqual([])
  })

  it('names Arc in one FAQ answer only: where customers pay today', () => {
    const naming = FAQS.filter((f) => ARC.test(f.q) || ARC.test(f.a)).map((f) => f.q)
    expect(naming).toEqual(['What if my customer wants to pay from a different chain?'])
  })
})
