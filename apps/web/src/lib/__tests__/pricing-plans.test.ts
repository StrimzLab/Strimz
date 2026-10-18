import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { MerchantTier } from '@strimz/shared-config'

import {
  PLAN_COMPARISON,
  PRICING_PLANS,
  nextPlanNotice,
  planFeeLabel,
  planLockedNotice,
} from '../pricing-plans'

const WEB_ROOT = join(__dirname, '..', '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')

const UNBUILT =
  /custom domain|any USDC chain|cctp|webhook events|slack|sla\b|uptime|solutions engineer|legal terms|dedicated/iu

describe('pricing plans', () => {
  it('lists Free, Starter, Growth and Enterprise at the fees the registry charges', () => {
    expect(PRICING_PLANS.map((p) => [p.name, p.price])).toEqual([
      ['Free', '0%'],
      ['Starter', '0.5%'],
      ['Growth', '0.4%'],
      ['Enterprise', 'Custom'],
    ])
  })

  it('reads the thresholds as all-time volume', () => {
    expect(PRICING_PLANS.map((p) => p.threshold)).toEqual([
      'First $1,000 processed',
      'From $1,000 processed',
      'From $50,000 processed',
      'By contract',
    ])
  })

  it('sends Free, Starter and Growth to login and Enterprise to contact', () => {
    expect(PRICING_PLANS.map((p) => p.cta)).toEqual([
      { href: '/login', label: 'Start free' },
      { href: '/login', label: 'Start with Starter' },
      { href: '/login', label: 'Start with Growth' },
      { href: '/contact', label: 'Contact us' },
    ])
  })

  it('lists only features that exist', () => {
    for (const plan of PRICING_PLANS) {
      for (const line of [...plan.features, ...plan.excluded]) expect(line).not.toMatch(UNBUILT)
    }
    for (const row of PLAN_COMPARISON) expect(row.label).not.toMatch(UNBUILT)
  })

  it('gives the storefront, anomaly alerts, yield and priority email support from Starter', () => {
    const row = (label: RegExp) => PLAN_COMPARISON.find((r) => label.test(r.label))?.values
    expect(row(/storefront/iu)).toEqual([false, true, true, true])
    expect(row(/anomaly/iu)).toEqual([false, true, true, true])
    expect(row(/priority email support/iu)).toEqual([false, true, true, true])
    expect(row(/recovery/iu)).toEqual([true, true, true, true])
  })

  it('has no monthly volume caps', () => {
    for (const row of PLAN_COMPARISON) expect(row.label).not.toMatch(/cap|month/iu)
  })
})

describe('dashboard plan notices', () => {
  it('labels each plan fee', () => {
    expect(planFeeLabel('free')).toBe('0% per transaction')
    expect(planFeeLabel('starter')).toBe('0.5% per transaction')
    expect(planFeeLabel('growth')).toBe('0.4% per transaction')
    expect(planFeeLabel('enterprise')).toBe('Custom rate agreed with Strimz')
  })

  it('says a locked feature unlocks automatically at $1,000 processed', () => {
    expect(planLockedNotice('storefront')).toEqual({
      title: 'The storefront builder starts on Starter',
      body: 'Unlocks automatically at $1,000 processed. Every merchant starts on Free and moves up as volume grows.',
    })
  })

  it.each<[MerchantTier, string | null]>([
    ['free', 'Moves to Starter (0.5%) automatically at $1,000 processed.'],
    ['starter', 'Moves to Growth (0.4%) automatically at $50,000 processed.'],
    ['growth', 'Need a custom rate? Talk to us about Enterprise pricing.'],
    ['enterprise', null],
  ])('tells a %s merchant what comes next', (tier, notice) => {
    expect(nextPlanNotice(tier)).toBe(notice)
  })
})

describe('pricing surfaces use the plan module', () => {
  it.each(['src/app/(marketing)/pricing/page.tsx', 'src/components/marketing/home/pricing.tsx'])(
    '%s reads plans from the plan module',
    (path) => {
      const source = read(path)
      expect(source).toMatch(/@\/lib\/pricing-plans/u)
      expect(source).not.toMatch(/Talk to sales|\/signup|Contact sales/u)
    },
  )
})

describe('pricing thresholds follow the plan config', () => {
  it('derives the comparison row from PLANS', () => {
    const row = PLAN_COMPARISON.find((r) => r.label === 'Starts at all-time volume')
    expect(row?.values).toEqual(['Sign-up', '$1,000', '$50,000', 'By contract'])
  })

  it('names no Enterprise volume the config does not have', () => {
    const enterprise = PRICING_PLANS.find((p) => p.tier === 'enterprise')
    expect(enterprise?.threshold).toBe('By contract')
  })
})
