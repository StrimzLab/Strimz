import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Account, team, fee tier, payout wallet, and 2FA configuration.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
