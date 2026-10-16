import { describe, expect, it } from 'vitest'
import { arcModeFor, type ArcEnvironment } from '../src/index.js'

describe('arcModeFor', () => {
  it('runs testnet in test mode and mainnet in live mode', () => {
    expect(arcModeFor('testnet')).toBe('test')
    expect(arcModeFor('mainnet')).toBe('live')
  })

  it('throws on an unknown environment', () => {
    expect(() => arcModeFor('Mainnet' as ArcEnvironment)).toThrow(/"Mainnet"/u)
  })
})
