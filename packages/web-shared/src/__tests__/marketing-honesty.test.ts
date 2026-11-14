import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = fileURLToPath(new URL('../..', import.meta.url))

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.(tsx?|mdx)$/u.test(name) ? [path] : []
  })
}

const PUBLIC_FILES = [
  ...files(join(WEB_ROOT, 'src/app/(marketing)')),
  ...files(join(WEB_ROOT, 'src/components/marketing')),
  join(WEB_ROOT, 'src/lib/pricing-plans.ts'),
]

const INVENTED = [
  '$48M',
  '12,400',
  '99.97%',
  'Mercato',
  'Aperture',
  'Hexcell',
  'Northstar',
  'Pulsefin',
  'Bridgehead',
  'Built by the Strimz<',
  'London and Lagos',
  'Most popular',
  'identity verification',
  'app.strimz.finance',
  'Chains we accept payments from',
  'every feature',
]

describe('marketing pages make no invented claims', () => {
  it.each(INVENTED)('never says %s', (phrase) => {
    const hits = PUBLIC_FILES.filter((file) => readFileSync(file, 'utf8').includes(phrase)).map(
      (file) => relative(WEB_ROOT, file),
    )
    expect(hits).toEqual([])
  })
})

const HOMEPAGE_FILES = [
  ...files(join(WEB_ROOT, 'src/components/marketing/home')),
  ...files(join(WEB_ROOT, 'src/components/marketing/pricing')),
  join(WEB_ROOT, 'src/app/(marketing)/page.tsx'),
  join(WEB_ROOT, 'src/app/(marketing)/pricing/page.tsx'),
  join(WEB_ROOT, 'src/app/(marketing)/about/page.tsx'),
  join(WEB_ROOT, 'src/app/(marketing)/contact/page.tsx'),
  join(WEB_ROOT, 'src/lib/fee-estimate.ts'),
]

// These pages show what Strimz does; they do not quote other processors' prices or terms.
const COMPARISONS = [
  'chargeback',
  'on cards',
  'card rate',
  'card fee',
  'Card payments',
  'CARD_RATE',
  'card-rails',
  'card processor',
  'card-era',
  'three-day',
]

describe('the homepage, pricing, about and contact pages make no comparisons with cards', () => {
  it.each(COMPARISONS)('never says %s', (phrase) => {
    const hits = HOMEPAGE_FILES.filter((file) =>
      readFileSync(file, 'utf8').toLowerCase().includes(phrase.toLowerCase()),
    ).map((file) => relative(WEB_ROOT, file))
    expect(hits).toEqual([])
  })
})

// The contracts were audited privately and no report is public, so nothing may imply one.
const AUDIT_OVERCLAIMS = ['audit report', 'audited by', 'independently audited', 'certified']

describe('marketing pages do not overstate the audit', () => {
  it.each(AUDIT_OVERCLAIMS)('never says %s', (phrase) => {
    const hits = PUBLIC_FILES.filter((file) =>
      readFileSync(file, 'utf8').toLowerCase().includes(phrase),
    ).map((file) => relative(WEB_ROOT, file))
    expect(hits).toEqual([])
  })
})
