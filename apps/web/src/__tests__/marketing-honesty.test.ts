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
  'are audited',
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
