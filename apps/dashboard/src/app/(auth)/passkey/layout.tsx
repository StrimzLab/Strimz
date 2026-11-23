import type { Metadata } from 'next'

import { PasskeyMfaPrompt } from '@/components/dashboard/passkey-mfa-prompt'

export const metadata: Metadata = {
  title: 'Add a passkey',
  description: 'Sign in to Strimz with your fingerprint, face or device PIN.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PasskeyMfaPrompt />
    </>
  )
}
