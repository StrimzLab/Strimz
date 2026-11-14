import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { subscriptionChargeOutcomeSchema } from '@strimz/shared-types'
import { describe, expect, it, vi } from 'vitest'
import { chargeOutcomeView } from '@/lib/charge-outcome'
import type { MerchantApiClient } from '@/lib/merchant-api/client'
import { SubscriptionsResource } from '@/lib/merchant-api/resources/subscriptions'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')

// ADR-2026-11-13-subscription-charge-history (#400).
describe('subscription charge history', () => {
  it('labels a delisted-token skip as neutral, not a failure', () => {
    expect(chargeOutcomeView('token_not_allowed', 'failed')).toEqual({
      label: 'Skipped: token not accepted',
      tone: 'neutral',
    })
  })

  it.each(subscriptionChargeOutcomeSchema.options)('has a label for %s', (outcome) => {
    const view = chargeOutcomeView(outcome, 'failed')
    expect(view.label.length).toBeGreaterThan(0)
    expect(view.label).not.toMatch(/_/u)
  })

  it('marks payment failures as danger and a charge as positive', () => {
    expect(chargeOutcomeView('insufficient_funds', 'failed')).toEqual({
      label: 'Failed: not enough balance',
      tone: 'danger',
    })
    expect(chargeOutcomeView('charged', 'succeeded').tone).toBe('positive')
  })

  it('falls back to the status while there is no outcome yet', () => {
    expect(chargeOutcomeView(null, 'in_flight')).toEqual({ label: 'In flight', tone: 'info' })
  })

  it('fetches attempts from the API', async () => {
    const get = vi.fn().mockResolvedValue({ data: [], hasMore: false, nextCursor: null })
    const resource = new SubscriptionsResource({ get } as unknown as MerchantApiClient)
    await resource.charges('sub_1', { limit: 25, cursor: 'c_1' })
    expect(get).toHaveBeenCalledWith('/v1/subscriptions/sub_1/charges', {
      query: { limit: 25, cursor: 'c_1' },
    })
  })

  it('shows a Charge attempts card with loading, empty, error and more states', () => {
    const page = read('src/app/(dashboard)/app/subscriptions/[id]/page.tsx')
    expect(page).toMatch(/Charge attempts/u)
    expect(page).toMatch(/useSubscriptionCharges\(/u)
    expect(page).toMatch(/chargeOutcomeView\(/u)
    expect(page).toMatch(/No charge attempts yet/u)
    expect(page).toMatch(/fetchNextPage/u)
    expect(page).toMatch(/Couldn&apos;t load charge attempts/u)
  })
})
