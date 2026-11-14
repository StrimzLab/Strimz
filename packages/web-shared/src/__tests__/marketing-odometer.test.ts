import { describe, expect, it } from 'vitest'
import { odometerCells } from '@/components/marketing/motion/odometer-cells'

describe('odometerCells', () => {
  it('rolls digits and keeps symbols still', () => {
    expect(odometerCells('$1,194')).toEqual([
      { kind: 'static', char: '$' },
      { kind: 'digit', value: 1 },
      { kind: 'static', char: ',' },
      { kind: 'digit', value: 1 },
      { kind: 'digit', value: 9 },
      { kind: 'digit', value: 4 },
    ])
  })

  it('handles zero', () => {
    expect(odometerCells('$0')).toEqual([
      { kind: 'static', char: '$' },
      { kind: 'digit', value: 0 },
    ])
  })
})
