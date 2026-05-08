import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Onboarding',
  description: 'Finish setting up your Strimz merchant account — payout wallet, plan, and 2FA.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
