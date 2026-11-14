import { describe, expect, it } from 'vitest'
import { pivotVolumeByCurrency } from '../admin-volume'

describe('pivotVolumeByCurrency', () => {
  it('gives each currency its own series and never adds them together', () => {
    const { currencies, points } = pivotVolumeByCurrency([
      { day: '2026-10-02', currency: 'EURC', volume: '3000000', fees: '30000' },
      { day: '2026-10-01', currency: 'USDC', volume: '10000000', fees: '100000' },
      { day: '2026-10-02', currency: 'USDC', volume: '1500000', fees: '15000' },
    ])
    expect(currencies).toEqual(['USDC', 'EURC'])
    expect(points).toEqual([
      { day: '10-01', USDC: 10, USDC_fees: 0.1, EURC: 0, EURC_fees: 0 },
      { day: '10-02', USDC: 1.5, USDC_fees: 0.015, EURC: 3, EURC_fees: 0.03 },
    ])
  })

  it('refuses two rows for the same day and currency', () => {
    expect(() =>
      pivotVolumeByCurrency([
        { day: '2026-10-01', currency: 'USDC', volume: '1', fees: '0' },
        { day: '2026-10-01', currency: 'USDC', volume: '2', fees: '0' },
      ]),
    ).toThrow(/more than one USDC volume row/)
  })
})
