import { describe, expect, it } from 'vitest'

import { resolveArcEnvironment } from '../arc-network'

describe('resolveArcEnvironment', () => {
  it.each(['testnet', 'mainnet'] as const)('accepts %s in a production build', (value) => {
    expect(resolveArcEnvironment(value, 'production')).toBe(value)
  })

  it.each(['prod', 'Mainnet', ''])('refuses %j in any build', (value) => {
    expect(() => resolveArcEnvironment(value, 'development')).toThrow(
      /NEXT_PUBLIC_ARC_ENVIRONMENT/u,
    )
  })

  it('refuses an unset value in a production build', () => {
    expect(() => resolveArcEnvironment(undefined, 'production')).toThrow(
      /NEXT_PUBLIC_ARC_ENVIRONMENT/u,
    )
  })

  it('uses testnet when unset outside production', () => {
    expect(resolveArcEnvironment(undefined, 'development')).toBe('testnet')
  })
})
