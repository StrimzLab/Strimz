export interface ClearableCache {
  clear(): void
}

export interface SessionCacheGuard {
  observe(userId: string | null): void
}

export function createSessionCacheGuard(cache: ClearableCache): SessionCacheGuard {
  let current: string | null = null
  return {
    observe(userId) {
      if (current !== null && current !== userId) cache.clear()
      current = userId
    },
  }
}
