import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')
const onboarding = readFileSync(join(SRC, 'app/(auth)/onboarding/page.tsx'), 'utf8')
const header = readFileSync(
  join(SRC, '../../../packages/web-shared/src/components/dashboard/page-header.tsx'),
  'utf8',
)

describe('onboarding (#488)', () => {
  it('does not show the payout wallet address', () => {
    expect(onboarding).not.toMatch(/Your payout wallet/u)
    expect(onboarding).not.toMatch(/\{payoutAddress \|\|/u)
  })

  it('still registers with the payout address', () => {
    expect(onboarding).toMatch(/payoutAddress: payoutAddress as/u)
  })
})

describe('page header Learn link (#489)', () => {
  it('uses the brand text colour so it stands out', () => {
    const at = header.indexOf('aria-label={`Learn about')
    const cls = header.slice(header.lastIndexOf('className="', at), at)
    expect(cls).toMatch(/\btext-brand-text\b/u)
    expect(cls).not.toMatch(/\btext-muted-foreground\b/u)
  })
})
