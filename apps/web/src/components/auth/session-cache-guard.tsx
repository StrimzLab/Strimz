'use client'

import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'

import { createSessionCacheGuard, type ClearableCache } from '@/lib/session-cache'

export function SessionCacheGuard({ cache }: { cache: ClearableCache }) {
  const { ready, user } = usePrivy()
  const [guard] = useState(() => createSessionCacheGuard(cache))
  const userId = user?.id ?? null

  useEffect(() => {
    if (ready) guard.observe(userId)
  }, [guard, ready, userId])

  return null
}
