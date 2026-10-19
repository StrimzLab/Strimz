import { describe, expect, it } from 'vitest'
import { EMPTY_STATES } from '../empty-states'

describe('list empty states', () => {
  it('cover the business lists', () => {
    expect(Object.keys(EMPTY_STATES).sort()).toEqual(
      [
        'customers',
        'invoices',
        'paymentLinks',
        'plans',
        'refunds',
        'subscriptions',
        'transactions',
      ].sort(),
    )
  })

  it.each(Object.entries(EMPTY_STATES))(
    '%s explains the outcome and offers a no-code action',
    (_, s) => {
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.description.split(' ').length).toBeGreaterThan(8)
      expect(s.action.href).toMatch(/^\/app\//u)
      expect(s.action.href).not.toMatch(/api-keys/u)
    },
  )
})
