'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'

import { useIdleLogout } from '@/hooks/use-idle-logout'

/**
 * Signs a merchant or admin out of the dashboard after a stretch of
 * inactivity, then sends them to /login. Mounted inside the auth-walled
 * layouts; renders nothing. The timer only arms once Privy reports an
 * authenticated session.
 */
export function InactivityLogout({ timeoutMinutes = 15 }: { timeoutMinutes?: number }) {
  const router = useRouter()
  const privy = usePrivyOrNull()

  useIdleLogout(
    timeoutMinutes * 60_000,
    () => {
      void (async () => {
        try {
          await privy?.logout?.()
        } finally {
          router.replace('/login')
        }
      })()
    },
    Boolean(privy?.authenticated),
  )

  return null
}

// Privy throws if used outside its provider (e.g. a build with no app id).
// The dashboard is always inside the provider, but stay defensive to match
// the rest of the app.
function usePrivyOrNull() {
  try {
    return usePrivy()
  } catch {
    return null
  }
}
