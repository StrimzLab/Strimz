'use client'

import { useCallback } from 'react'
import { useMfaEnrollment, usePrivy, type User } from '@privy-io/react-auth'

import { syncSession } from '@/lib/auth-sync'
import { passkeysOf } from '@/lib/passkeys'

export function hasPasskeyMfa(user: User | null): boolean {
  return Boolean(user?.mfaMethods?.includes('passkey'))
}

/** Makes the account's passkeys its second factor, so sensitive actions can ask for them. */
export function useEnrolPasskeyMfa() {
  const { initEnrollmentWithPasskey, submitEnrollmentWithPasskey } = useMfaEnrollment()
  return useCallback(
    async (user: User) => {
      const credentialIds = passkeysOf(user.linkedAccounts).map((p) => p.credentialId)
      if (credentialIds.length === 0) throw new Error('Add a passkey first.')
      await initEnrollmentWithPasskey()
      await submitEnrollmentWithPasskey({ credentialIds })
      // Privy sends no webhook for enrolment, so the API's copy stays stale until told.
      const r = await syncSession()
      if (!r.ok)
        throw new Error(`Your passkey is set up, but Strimz could not refresh (${r.status}).`)
    },
    [initEnrollmentWithPasskey, submitEnrollmentWithPasskey],
  )
}

export function usePasskeyMfa() {
  const { user } = usePrivy()
  return { user, enrolled: hasPasskeyMfa(user) }
}
