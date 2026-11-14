type BroadcastStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const KEY_PREFIX = 'strimz.refund.broadcast.'

export interface RefundBroadcastMemory {
  pending(refundId: string): `0x${string}` | null
  remember(refundId: string, txHash: `0x${string}`): void
  forget(refundId: string): void
}

export function createRefundBroadcastMemory(store: BroadcastStore): RefundBroadcastMemory {
  return {
    pending(refundId) {
      const value = store.getItem(KEY_PREFIX + refundId)
      return value && /^0x[0-9a-fA-F]{64}$/.test(value) ? (value as `0x${string}`) : null
    },
    remember(refundId, txHash) {
      store.setItem(KEY_PREFIX + refundId, txHash)
    },
    forget(refundId) {
      store.removeItem(KEY_PREFIX + refundId)
    },
  }
}

export function browserRefundBroadcastMemory(): RefundBroadcastMemory | null {
  if (typeof window === 'undefined') return null
  const probeKey = KEY_PREFIX + 'probe'
  try {
    window.localStorage.setItem(probeKey, '1')
    window.localStorage.removeItem(probeKey)
  } catch (err) {
    console.warn('[refunds] browser storage is unavailable:', err)
    return null
  }
  return createRefundBroadcastMemory(window.localStorage)
}
