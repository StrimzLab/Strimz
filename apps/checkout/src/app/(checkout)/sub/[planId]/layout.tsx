import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Subscribe',
  description: 'Subscribe with USDC from your wallet. Approve once, then each charge is automatic.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
