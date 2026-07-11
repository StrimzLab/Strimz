import type { Metadata } from 'next'

/**
 * Onboarding lives in the `(auth)` route group so it inherits the
 * two-column dark auth shell. The merchant is still in the "signing
 * up" flow, not yet in the dashboard. The `(auth)` group's
 * `layout.tsx` renders the shell; this file just carries the per-page
 * metadata.
 */
export const metadata: Metadata = {
  title: 'Onboarding',
  description:
    'Finish setting up your Strimz merchant account. Business details and payout wallet.',
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children
}
