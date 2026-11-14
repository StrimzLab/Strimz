import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { webTree } from './web-source'

const HOOKS = join(webTree(), 'src/hooks/api')
const read = (file: string) => readFileSync(join(HOOKS, file), 'utf8')

// The body of one exported hook, up to the next export.
function hook(file: string, name: string): string {
  const source = read(file)
  const start = source.indexOf(`export function ${name}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const next = source.indexOf('\nexport ', start + 1)
  return source.slice(start, next === -1 ? undefined : next)
}

const refreshesSummary = /invalidateQueries\(\{ queryKey: analyticsKeys\.all \}\)/u

describe('stat cards follow the tables', () => {
  it.each([
    ['use-payment-sessions.ts', 'useCreatePaymentSession'],
    ['use-payment-sessions.ts', 'useCancelPaymentSession'],
    ['use-subscriptions.ts', 'useCancelSubscription'],
  ])('%s %s refreshes the stats summary', (file, name) => {
    expect(hook(file, name)).toMatch(refreshesSummary)
  })

  it('polls the summary so on-chain payments show up without a click', () => {
    const summary = hook('use-analytics.ts', 'useStatsSummary')
    expect(summary).toMatch(/refetchInterval: SUMMARY_REFRESH_MS/u)
    expect(summary).not.toMatch(/LONG_STALE_TIME/u)
    expect(read('use-analytics.ts')).toMatch(/const SUMMARY_REFRESH_MS = 30_000/u)
  })
})
