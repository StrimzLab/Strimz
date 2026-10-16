import { describe, expect, it } from 'vitest'
import { createRefundBroadcastMemory } from '../refund-broadcast'

function fakeStore() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  }
}

const hash = `0x${'a'.repeat(64)}` as const

describe('refund broadcast memory', () => {
  it('returns the remembered hash for a refund until it is forgotten', () => {
    const memory = createRefundBroadcastMemory(fakeStore())
    expect(memory.pending('rf_1')).toBeNull()
    memory.remember('rf_1', hash)
    expect(memory.pending('rf_1')).toBe(hash)
    expect(memory.pending('rf_2')).toBeNull()
    memory.forget('rf_1')
    expect(memory.pending('rf_1')).toBeNull()
  })

  it('ignores a stored value that is not a transaction hash', () => {
    const store = fakeStore()
    store.map.set('strimz.refund.broadcast.rf_1', 'garbage')
    expect(createRefundBroadcastMemory(store).pending('rf_1')).toBeNull()
  })
})
